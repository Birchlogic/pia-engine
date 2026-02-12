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

    const rows = await prisma.dataMatrixRow.findMany({
        where: { verticalId },
        orderBy: [{ riskScore: "desc" }, { confidenceScore: "asc" }],
    });

    const matrix = await prisma.dataMatrix.findUnique({
        where: { verticalId },
    });

    return NextResponse.json({ matrix, rows });
}

export async function PUT(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { rowIds, status } = body;

    if (!rowIds || !Array.isArray(rowIds) || !status) {
        return NextResponse.json({ error: "rowIds array and status required" }, { status: 400 });
    }

    await prisma.dataMatrixRow.updateMany({
        where: { id: { in: rowIds } },
        data: {
            status,
            reviewedById: user.id,
            reviewedAt: new Date(),
        },
    });

    return NextResponse.json({ updated: rowIds.length });
}
