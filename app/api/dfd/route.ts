import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const verticalId = searchParams.get("verticalId");

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    const dfdGraph = await prisma.dFDGraph.findFirst({
        where: { verticalId, dfdType: "vertical" },
        orderBy: { createdAt: "desc" },
    });

    if (!dfdGraph || !dfdGraph.graphData) {
        return NextResponse.json({ graph: null });
    }

    const graphData = dfdGraph.graphData as Record<string, unknown>;

    return NextResponse.json({
        graph: {
            id: dfdGraph.id,
            status: dfdGraph.status,
            createdAt: dfdGraph.createdAt,
            mermaidCode: graphData.mermaidCode || null,
            summary: graphData.summary || null,
            nodeCount: graphData.nodeCount || 0,
            edgeCount: graphData.edgeCount || 0,
            highRiskFlows: graphData.highRiskFlows || [],
            crossBorderFlows: graphData.crossBorderFlows || [],
            unencryptedFlows: graphData.unencryptedFlows || [],
        },
    });
}
