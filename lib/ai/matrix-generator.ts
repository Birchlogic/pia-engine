import prisma from "@/lib/db/prisma";
import { extractEntitiesBatch } from "./entity-extraction";
import { buildRelationshipGraph } from "./relationship-graph";
import { classifyDataElements } from "./classification";
import { computeRiskScore } from "./risk-scoring";
import type { ProgressEvent, ClassifiedDataElement } from "./schemas";

interface GenerateMatrixOptions {
    verticalId: string;
    onProgress?: (event: ProgressEvent) => void;
}

/**
 * Full matrix generation orchestrator.
 * Steps: extract → graph → classify → score → dedup → persist
 */
export async function generateDataMatrix(options: GenerateMatrixOptions) {
    const { verticalId, onProgress } = options;

    const emit = (step: ProgressEvent["step"], message: string, progress: number, detail?: string) => {
        onProgress?.({ step, message, progress, detail });
    };

    // Load vertical with finalized sessions and org context
    const vertical = await prisma.vertical.findUnique({
        where: { id: verticalId },
        include: {
            sessions: {
                where: { status: "finalized" },
                select: {
                    id: true,
                    rawTextNotes: true,
                    aiSummary: true,
                    intervieweeNames: true,
                    intervieweeRoles: true,
                },
            },
            project: {
                include: {
                    organization: {
                        select: { industry: true, regulatoryScope: true },
                    },
                },
            },
        },
    });

    if (!vertical) throw new Error("Vertical not found");
    if (vertical.sessions.length === 0) throw new Error("No finalized sessions");

    const orgIndustry = vertical.project.organization.industry ?? "General";
    const regulatoryScope = vertical.project.organization.regulatoryScope ?? [];

    // ── Step 1: Entity Extraction ──
    emit("extracting", "Extracting privacy entities from sessions...", 5);

    const extractionResults = await extractEntitiesBatch(
        vertical.sessions,
        vertical.name,
        (completed, total) => {
            const pct = 5 + Math.round((completed / total) * 25);
            emit("extracting", `Extracting entities... (${completed}/${total} sessions)`, pct);
        }
    );

    const totalEntities = extractionResults.reduce((sum, r) => sum + r.entities.length, 0);
    emit("extracting", `Extracted ${totalEntities} entities from ${vertical.sessions.length} sessions`, 30);

    // ── Step 2: Relationship Graph ──
    emit("building_graph", "Constructing relationship graph...", 35);

    const graph = await buildRelationshipGraph(extractionResults, vertical.name);
    emit("building_graph", `Built graph with ${graph.data_elements.length} data elements`, 50);

    // ── Step 3: Classification ──
    emit("classifying", "Classifying and enriching data elements...", 55);

    const classification = await classifyDataElements(graph, orgIndustry, regulatoryScope);
    emit("classifying", `Classified ${classification.elements.length} elements`, 70);

    // ── Step 4: Risk Scoring ──
    emit("scoring", "Computing risk scores...", 75);

    const scoredElements = classification.elements.map((el) => ({
        ...el,
        risk: computeRiskScore(el),
    }));
    emit("scoring", `Scored ${scoredElements.length} elements`, 80);

    // ── Step 5: Deduplication ──
    emit("deduplicating", "Deduplicating data elements...", 82);

    const dedupedElements = deduplicateElements(scoredElements);
    emit("deduplicating", `${dedupedElements.length} unique data elements after dedup`, 85);

    // ── Step 6: Persist ──
    emit("persisting", "Saving to database...", 88);

    // Upsert DataMatrix aggregate
    const dataMatrix = await prisma.dataMatrix.upsert({
        where: { verticalId },
        create: {
            verticalId,
            status: "draft",
            generationMetadata: {
                total_rows: dedupedElements.length,
                avg_confidence:
                    dedupedElements.reduce((s, e) => s + e.confidence_score, 0) / dedupedElements.length,
                generated_at: new Date().toISOString(),
                sessions_used: vertical.sessions.map((s) => s.id),
            },
        },
        update: {
            status: "draft",
            generationMetadata: {
                total_rows: dedupedElements.length,
                avg_confidence:
                    dedupedElements.reduce((s, e) => s + e.confidence_score, 0) / dedupedElements.length,
                regenerated_at: new Date().toISOString(),
                sessions_used: vertical.sessions.map((s) => s.id),
            },
        },
    });

    // Delete existing rows for this vertical (regeneration is idempotent)
    await prisma.dataMatrixRow.deleteMany({ where: { verticalId } });

    // Insert new rows
    for (const el of dedupedElements) {
        await prisma.dataMatrixRow.create({
            data: {
                verticalId,
                dataElementName: el.data_element_name,
                dataCategory: el.data_category as "personal",
                dataSubCategory: el.data_sub_category,
                dataSubjects: el.data_subjects,
                sourceOfData: el.source_of_data,
                collectionMethod: el.collection_method,
                purposeOfProcessing: el.purpose_of_processing,
                legalBasis: el.legal_basis,
                consentMechanism: el.consent_mechanism as Record<string, unknown> | null,
                processingTypes: el.processing_types,
                systemsApplications: el.systems_applications,
                storageLocation: el.storage_location,
                storageFormat: el.storage_format,
                encryptionAtRest: el.encryption_at_rest as "yes",
                encryptionInTransit: el.encryption_in_transit as "yes",
                retentionPeriod: el.retention_period,
                retentionCompliant: el.retention_compliant,
                deletionMethod: el.deletion_method,
                accessRoles: el.access_roles as unknown as Record<string, unknown>,
                dataRecipientsInternal: el.data_recipients_internal,
                dataRecipientsExternal: el.data_recipients_external,
                thirdPartyDetails: el.third_party_details as unknown as Record<string, unknown> | null,
                crossBorderTransfer: el.cross_border_transfer,
                crossBorderDetails: el.cross_border_details as Record<string, unknown> | null,
                dataOwner: el.data_owner,
                riskScore: el.risk.final_score,
                confidenceScore: el.confidence_score,
                gapsFlagged: el.gaps_flagged,
                sourceSessionIds: vertical.sessions.map((s) => s.id),
                status: "draft",
                generatedBy: "ai",
            },
        });
    }

    // Update vertical assessment status
    await prisma.vertical.update({
        where: { id: verticalId },
        data: { assessmentStatus: "matrix_generated" },
    });

    emit("done", `Data Matrix generated: ${dedupedElements.length} rows`, 100);

    return {
        matrixId: dataMatrix.id,
        rowCount: dedupedElements.length,
        avgConfidence:
            dedupedElements.reduce((s, e) => s + e.confidence_score, 0) / dedupedElements.length,
    };
}

/**
 * Simple deduplication: merge elements with similar names.
 */
function deduplicateElements(
    elements: (ClassifiedDataElement & { risk: { final_score: number; sensitivity_weight: number; processing_risk: number; volume_indicator: number; exposure_factor: number } })[]
) {
    const seen = new Map<string, (typeof elements)[0]>();

    for (const el of elements) {
        const key = el.data_element_name.toLowerCase().replace(/[^a-z0-9]/g, "_");

        if (seen.has(key)) {
            const existing = seen.get(key)!;
            // Take higher confidence and merge gaps
            if (el.confidence_score > existing.confidence_score) {
                seen.set(key, {
                    ...el,
                    gaps_flagged: [...new Set([...existing.gaps_flagged, ...el.gaps_flagged])],
                });
            } else {
                existing.gaps_flagged = [...new Set([...existing.gaps_flagged, ...el.gaps_flagged])];
            }
        } else {
            seen.set(key, el);
        }
    }

    return Array.from(seen.values());
}
