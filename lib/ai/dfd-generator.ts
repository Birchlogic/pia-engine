import prisma from "@/lib/db/prisma";
import { llmCall } from "./llm-client";
import { mermaidDFDPrompt } from "./prompts";
import { MermaidDFDResultSchema } from "./schemas";
import type { ProgressEvent } from "./schemas";

// ── Types ──

interface GenerateDFDOptions {
    verticalId: string;
    onProgress?: (event: ProgressEvent) => void;
}

/**
 * LLM-powered Mermaid DFD generation from Data Matrix rows.
 *
 * Pipeline:
 * 1. Load vertical + matrix rows from DB
 * 2. Prepare a compact JSON summary of the matrix data
 * 3. Call LLM with the Mermaid DFD prompt to generate flowchart code
 * 4. Persist the Mermaid code + metadata in DFDGraph.graphData
 */
export async function generateDFD(options: GenerateDFDOptions) {
    const { verticalId, onProgress } = options;

    const emit = (step: ProgressEvent["step"], message: string, progress: number, detail?: string) => {
        onProgress?.({ step, message, progress, detail });
    };

    // ── Step 1: Load vertical + matrix rows ──
    emit("loading", "Loading data matrix rows...", 5);

    const vertical = await prisma.vertical.findUnique({
        where: { id: verticalId },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    organization: { select: { name: true } },
                },
            },
            matrixRows: { orderBy: { riskScore: "desc" } },
            dataMatrix: { select: { id: true, status: true } },
        },
    });

    if (!vertical) throw new Error("Vertical not found");
    if (vertical.matrixRows.length === 0) throw new Error("No data matrix rows found. Generate the Data Matrix first.");

    const matrixRows = vertical.matrixRows;
    emit("loading", `Loaded ${matrixRows.length} data matrix rows`, 15);

    // ── Step 2: Prepare compact matrix summary for LLM ──
    emit("generating_mermaid", "Preparing data for Mermaid generation...", 20);

    const matrixSummary = matrixRows.map((row) => ({
        data_element: row.dataElementName,
        category: row.dataCategory,
        data_subjects: row.dataSubjects,
        source: row.sourceOfData,
        collection_method: row.collectionMethod,
        purpose: row.purposeOfProcessing,
        systems: row.systemsApplications,
        storage_location: row.storageLocation,
        encryption_at_rest: row.encryptionAtRest,
        encryption_in_transit: row.encryptionInTransit,
        recipients_internal: row.dataRecipientsInternal,
        recipients_external: row.dataRecipientsExternal,
        cross_border: row.crossBorderTransfer,
        risk_score: row.riskScore,
        retention: row.retentionPeriod,
        gaps: row.gapsFlagged,
    }));

    const matrixDataJson = JSON.stringify(matrixSummary, null, 2);

    // ── Step 3: Call LLM to generate Mermaid code ──
    emit("generating_mermaid", "Generating Mermaid DFD via LLM...", 30);

    const prompt = mermaidDFDPrompt(
        matrixDataJson,
        vertical.name,
        vertical.project.organization.name
    );

    const result = await llmCall({
        prompt,
        schema: MermaidDFDResultSchema,
        temperature: 0.2,
        maxRetries: 2,
    });

    emit("generating_mermaid", `Mermaid DFD generated: ${result.node_count} nodes, ${result.edge_count} edges`, 70);

    // ── Step 4: Persist to database ──
    emit("persisting", "Saving DFD to database...", 75);

    // Delete existing DFD for this vertical (regeneration is idempotent)
    await prisma.dFDGraph.deleteMany({
        where: { verticalId, dfdType: "vertical" },
    });

    // Create DFD graph with Mermaid code stored in graphData
    const dfdGraph = await prisma.dFDGraph.create({
        data: {
            projectId: vertical.project.id,
            verticalId,
            dfdType: "vertical",
            status: "draft",
            generatedFromMatrixIds: vertical.dataMatrix ? [vertical.dataMatrix.id] : [],
            graphData: {
                mermaidCode: result.mermaid_code,
                summary: result.summary,
                nodeCount: result.node_count,
                edgeCount: result.edge_count,
                highRiskFlows: result.high_risk_flows,
                crossBorderFlows: result.cross_border_flows,
                unencryptedFlows: result.unencrypted_flows,
                generatedAt: new Date().toISOString(),
            },
            layoutConfig: {
                type: "mermaid",
                direction: "LR",
            },
        },
    });

    emit("persisting", "Saving complete", 90);

    // Update vertical assessment status
    await prisma.vertical.update({
        where: { id: verticalId },
        data: { assessmentStatus: "dfd_generated" },
    });

    emit("done", `DFD generated: ${result.node_count} nodes, ${result.edge_count} edges`, 100);

    return {
        dfdGraphId: dfdGraph.id,
        nodeCount: result.node_count,
        edgeCount: result.edge_count,
    };
}
