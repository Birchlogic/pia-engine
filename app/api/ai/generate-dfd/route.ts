import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import prisma from "@/lib/db/prisma";
import { generateMermaid, type SchemaOne } from "@/lib/ai/mermaid-converter";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { verticalId } = body;

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    try {
        // 1. Read Schema-1 from DataMatrix
        const dataMatrix = await prisma.dataMatrix.findUnique({
            where: { verticalId },
        });

        if (!dataMatrix || !dataMatrix.schemaOneJson) {
            return NextResponse.json(
                { error: "No Schema-1 found. Please generate the Data Matrix first." },
                { status: 400 }
            );
        }

        // 2. Convert Schema-1 to Mermaid code (deterministic)
        const schemaOne = dataMatrix.schemaOneJson as unknown as SchemaOne;
        const mermaidCode = generateMermaid(schemaOne);

        // 3. Store Mermaid code in DfdGraph (upsert - overwrite on regenerate)
        await prisma.dfdGraph.upsert({
            where: { verticalId },
            create: {
                verticalId,
                mermaidCode,
            },
            update: {
                mermaidCode,
            },
        });

        // 4. Update vertical assessment status
        await prisma.vertical.update({
            where: { id: verticalId },
            data: { assessmentStatus: "dfd_generated" },
        });

        return NextResponse.json({
            success: true,
            mermaidCode,
        });

    } catch (err) {
        console.error("Generate DFD error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to generate DFD" },
            { status: 500 }
        );
    }
}
