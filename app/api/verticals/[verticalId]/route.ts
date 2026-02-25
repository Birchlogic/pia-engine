import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    try {
        const vertical = await prisma.vertical.findUnique({
            where: { id: verticalId },
            include: {
                project: {
                    select: { id: true, name: true, organization: { select: { id: true, name: true } } },
                },
                sessions: {
                    orderBy: { sessionDate: "desc" },
                    include: {
                        files: {
                            select: {
                                id: true,
                                fileName: true,
                                fileSizeBytes: true,
                                fileType: true,
                                mimeType: true,
                                transcriptionStatus: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: "desc" },
                        },
                        _count: { select: { files: true } },
                        creator: { select: { name: true } },
                    },
                },
                dataMatrix: true,
                _count: { select: { sessions: true, dataMappingRows: true } },
            },
        });

        if (!vertical) {
            console.error(`Vertical not found: ${verticalId}`);
            return NextResponse.json({ error: "Vertical not found" }, { status: 404 });
        }

        // Handle BigInt serialization
        const serializedVertical = JSON.parse(
            JSON.stringify(vertical, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            )
        );

        return NextResponse.json(serializedVertical);
    } catch (error) {
        console.error("Error fetching vertical:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;
    const body = await request.json();

    const vertical = await prisma.vertical.update({
        where: { id: verticalId },
        data: {
            name: body.name,
            description: body.description,
            headName: body.headName,
            headRole: body.headRole,
            headContact: body.headContact,
            assessmentStatus: body.assessmentStatus,
        },
    });

    return NextResponse.json(vertical);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    await prisma.vertical.delete({ where: { id: verticalId } });

    return NextResponse.json({ success: true });
}
