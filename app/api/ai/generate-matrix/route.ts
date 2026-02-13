import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import prisma from "@/lib/db/prisma";
import { llmCall } from "@/lib/ai/llm-client";
import { SCHEMA_ONE_SYSTEM_PROMPT, DATA_MAPPING_SYSTEM_PROMPT } from "@/lib/ai/schema1-prompt";
import { z } from "zod";

// Zod schema for Schema-1 validation (enriched with data mapping + process fields)
const DataElementSchema = z.object({
    name: z.string(),
    description: z.string().optional().default(""),
    classification: z.string().optional().default("Not specified"),
    purpose: z.string().optional().default("Not specified"),
    retention_period: z.string().optional().default("Not specified"),
    legal_basis: z.string().optional().default("Not specified"),
    storage_location: z.string().optional().default("Not specified"),
    owner: z.string().optional().default("Not specified"),
});

const SubProcessSchema = z.object({
    name: z.string(),
    description: z.string().optional().default(""),
    routing: z.string().optional().default("Not specified"),
});

const IntegrationSchema = z.object({
    system: z.string(),
    type: z.string().optional().default("Not specified"),
    direction: z.string().optional().default("Not specified"),
});

const SchemaOneSchema = z.object({
    meta: z.object({
        project_name: z.string().optional(),
        vertical_name: z.string().optional(),
        generated_at: z.string().optional(),
    }).optional(),
    nodes: z.array(z.object({
        id: z.string(),
        type: z.enum(["EXTERNAL_ENTITY", "PROCESS", "DATA_STORE"]),
        label: z.string(),
        description: z.string().optional(),
        data_elements: z.array(DataElementSchema).optional().default([]),
        // PROCESS-specific
        sub_processes: z.array(SubProcessSchema).optional().default([]),
        sla: z.string().optional().default("Not specified"),
        // DATA_STORE-specific
        integrations: z.array(IntegrationSchema).optional().default([]),
        // All nodes
        reference_documents: z.array(z.string()).optional().default([]),
    })),
    flows: z.array(z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        label: z.string(),
        data_elements: z.array(z.string()).optional().default([]),
        bi_directional: z.boolean().default(false),
        transfer_mechanism: z.string().optional().default("Not specified"),
        cross_border: z.union([z.boolean(), z.null()]).optional().default(null),
    })),
});

// Zod schema for Data Mapping rows validation
const DataMappingSchema = z.array(z.object({
    data_category: z.string(),
    description: z.string(),
    purpose: z.string(),
    data_owner: z.string(),
    storage_location: z.string(),
    data_classification: z.string(),
    retention_period: z.string(),
    legal_basis: z.string(),
}));

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { verticalId } = body;

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    try {
        // 1. Collect all finalized session transcripts
        const sessions = await prisma.interviewSession.findMany({
            where: { verticalId, status: "finalized" },
            include: { files: true },
            orderBy: { sessionNumber: "asc" },
        });

        if (sessions.length === 0) {
            return NextResponse.json(
                { error: "No finalized sessions found. Please finalize at least one session." },
                { status: 400 }
            );
        }

        // Combine all transcript text
        let combinedTranscript = "";
        for (const session of sessions) {
            if (session.rawTextNotes) {
                combinedTranscript += `\n--- Session ${session.sessionNumber} Notes ---\n${session.rawTextNotes}\n`;
            }
            for (const file of session.files) {
                if (file.transcribedText) {
                    combinedTranscript += `\n--- Session ${session.sessionNumber} File: ${file.fileName} ---\n${file.transcribedText}\n`;
                }
            }
        }

        if (!combinedTranscript.trim()) {
            return NextResponse.json(
                { error: "No transcript text found in finalized sessions." },
                { status: 400 }
            );
        }

        // 2. LLM Call 1: Transcripts → Schema-1
        const schemaOnePrompt = `${SCHEMA_ONE_SYSTEM_PROMPT}\n\n--- BEGIN TRANSCRIPTS ---\n${combinedTranscript}\n--- END TRANSCRIPTS ---`;

        const schemaOne = await llmCall({
            prompt: schemaOnePrompt,
            schema: SchemaOneSchema,
            temperature: 0.1,
            maxRetries: 2,
        });

        // 3. Store Schema-1 in DataMatrix (upsert - overwrite on regenerate)
        await prisma.dataMatrix.upsert({
            where: { verticalId },
            create: {
                verticalId,
                schemaOneJson: schemaOne as object,
            },
            update: {
                schemaOneJson: schemaOne as object,
            },
        });

        // 4. LLM Call 2: Schema-1 → Data Mapping rows
        const dataMappingPrompt = `${DATA_MAPPING_SYSTEM_PROMPT}\n\n--- BEGIN SCHEMA-1 ---\n${JSON.stringify(schemaOne, null, 2)}\n--- END SCHEMA-1 ---`;

        const dataMappingRows = await llmCall({
            prompt: dataMappingPrompt,
            schema: DataMappingSchema,
            temperature: 0.1,
            maxRetries: 2,
        });

        // 5. Delete existing mapping rows and insert new ones (overwrite)
        await prisma.dataMappingRow.deleteMany({
            where: { verticalId },
        });

        const createdRows = await Promise.all(
            dataMappingRows.map((row: z.infer<typeof DataMappingSchema>[number], index: number) =>
                prisma.dataMappingRow.create({
                    data: {
                        verticalId,
                        sNo: index + 1,
                        dataCategory: row.data_category,
                        description: row.description,
                        purpose: row.purpose,
                        dataOwner: row.data_owner,
                        storageLocation: row.storage_location,
                        dataClassification: row.data_classification,
                        retentionPeriod: row.retention_period,
                        legalBasis: row.legal_basis,
                    },
                })
            )
        );

        // 6. Update vertical assessment status
        await prisma.vertical.update({
            where: { id: verticalId },
            data: { assessmentStatus: "matrix_generated" },
        });

        return NextResponse.json({
            success: true,
            rowCount: createdRows.length,
            message: `Generated ${createdRows.length} data mapping rows.`,
        });

    } catch (err) {
        console.error("Generate matrix error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to generate data matrix" },
            { status: 500 }
        );
    }
}
