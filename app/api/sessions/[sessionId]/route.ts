import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
            files: true,
            creator: { select: { name: true } },
        },
    });

    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;
    const body = await request.json();

    // If appending notes, concat with existing
    let rawTextNotes = body.rawTextNotes;
    if (body.appendNotes) {
        const existing = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            select: { rawTextNotes: true, version: true },
        });
        if (existing?.rawTextNotes) {
            rawTextNotes = existing.rawTextNotes + "\n\n---\n\n" + body.appendNotes;
        } else {
            rawTextNotes = body.appendNotes;
        }
    }

    const updateData: Record<string, unknown> = {};
    if (rawTextNotes !== undefined) updateData.rawTextNotes = rawTextNotes;
    if (body.intervieweeNames !== undefined) updateData.intervieweeNames = body.intervieweeNames;
    if (body.intervieweeRoles !== undefined) updateData.intervieweeRoles = body.intervieweeRoles;
    if (body.interviewerNames !== undefined) updateData.interviewerNames = body.interviewerNames;
    if (body.assessmentCriteriaTags !== undefined) updateData.assessmentCriteriaTags = body.assessmentCriteriaTags;
    if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes;
    if (body.status !== undefined) updateData.status = body.status;

    // Bump version if content changed
    if (rawTextNotes !== undefined || body.appendNotes) {
        updateData.version = { increment: 1 };
    }

    const session = await prisma.interviewSession.update({
        where: { id: sessionId },
        data: updateData,
    });

    return NextResponse.json(session);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    await prisma.interviewSession.delete({ where: { id: sessionId } });

    return NextResponse.json({ success: true });
}
