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

        let userMessage = "Failed to generate DFD";
        if (err instanceof Error) {
            const msg = err.message;
            if (msg.includes("Schema-1") || msg.includes("Data Matrix")) {
                userMessage = msg;
            } else if (msg.includes("API error")) {
                userMessage = "AI service is temporarily unavailable. Please try again in a moment.";
            } else if (msg.includes("rate limit") || msg.includes("429")) {
                userMessage = "AI rate limit reached. Please wait 60 seconds and try again.";
            } else {
                userMessage = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
            }
        }

        return NextResponse.json(
            { error: userMessage },
            { status: 500 }
        );
    }
}
