import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            organization: { select: { id: true, name: true } },
            verticals: {
                orderBy: { sortOrder: "asc" },
                include: {
                    _count: { select: { sessions: true } },
                },
            },
            _count: { select: { verticals: true } },
        },
    });

    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { projectId } = await params;
    const body = await request.json();

    const project = await prisma.project.update({
        where: { id: projectId },
        data: {
            name: body.name,
            description: body.description,
            applicableRegulations: body.applicableRegulations,
            assessmentType: body.assessmentType,
            targetCompletionDate: body.targetCompletionDate
                ? new Date(body.targetCompletionDate)
                : null,
            status: body.status,
        },
    });

    return NextResponse.json(project);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { projectId } = await params;

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ success: true });
}
