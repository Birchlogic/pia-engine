import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ rowId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { rowId } = await params;

    const row = await prisma.dataMatrixRow.findUnique({
        where: { id: rowId },
    });

    if (!row) {
        return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json(row);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ rowId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { rowId } = await params;
    const body = await request.json();

    const row = await prisma.dataMatrixRow.update({
        where: { id: rowId },
        data: {
            ...body,
            reviewedById: user.id,
            reviewedAt: new Date(),
        },
    });

    return NextResponse.json(row);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ rowId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { rowId } = await params;

    await prisma.dataMatrixRow.delete({ where: { id: rowId } });

    return NextResponse.json({ success: true });
}
