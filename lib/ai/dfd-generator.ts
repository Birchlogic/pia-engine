import prisma from "@/lib/db/prisma";
import { generateMermaid, type SchemaOne } from "@/lib/ai/mermaid-converter";
import type { ProgressEvent } from "./schemas";

// ── Types ──

interface GenerateDFDOptions {
    verticalId: string;
    onProgress?: (event: ProgressEvent) => void;
}

/**
 * Deterministic Mermaid DFD generation from Schema-1 stored in DataMatrix.
 *
 * Pipeline:
 * 1. Load Schema-1 from DataMatrix.schemaOneJson
 * 2. Convert Schema-1 → Mermaid via mermaid-converter
 * 3. Upsert DfdGraph.mermaidCode
 */
export async function generateDFD(options: GenerateDFDOptions) {
    const { verticalId, onProgress } = options;

    const emit = (step: ProgressEvent["step"], message: string, progress: number, detail?: string) => {
        onProgress?.({ step, message, progress, detail });
    };

    emit("loading", "Loading Schema-1...", 10);

    const dataMatrix = await prisma.dataMatrix.findUnique({
        where: { verticalId },
        select: { schemaOneJson: true },
    });

    if (!dataMatrix?.schemaOneJson) {
        throw new Error("No Schema-1 found. Generate the Data Matrix first.");
    }

    emit("generating_mermaid", "Generating Mermaid diagram...", 40);
    const schemaOne = dataMatrix.schemaOneJson as unknown as SchemaOne;
    const mermaidCode = generateMermaid(schemaOne);

    emit("persisting", "Saving DFD...", 75);
    const dfdGraph = await prisma.dfdGraph.upsert({
        where: { verticalId },
        create: { verticalId, mermaidCode },
        update: { mermaidCode },
    });

    // Update vertical assessment status
    await prisma.vertical.update({
        where: { id: verticalId },
        data: { assessmentStatus: "dfd_generated" },
    });

    emit("done", "DFD generated", 100);

    return { dfdGraphId: dfdGraph.id };
}
