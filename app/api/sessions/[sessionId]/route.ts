import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";
import { logActivity } from "@/lib/activity";

// Helper: verify session belongs to user's org via session → vertical → project → org chain
async function verifySessionOrgAccess(user: { orgId: string | null }, sessionId: string) {
    if (!user.orgId) throw new Error("User is not assigned to any organization");

    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
        select: {
            id: true,
            vertical: {
                select: {
                    project: { select: { orgId: true } },
                },
            },
        },
    });

    if (!session) throw new Error("Session not found");
    if (session.vertical.project.orgId !== user.orgId) {
        throw new Error("Access denied: session belongs to a different organization");
    }

    return session;
}

// GET /api/sessions/[sessionId] — session detail (org-scoped)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { sessionId } = await params;
        await verifySessionOrgAccess(user, sessionId);

        const session = await prisma.interviewSession.findUnique({
            where: { id: sessionId },
            include: {
                files: true,
                creator: { select: { name: true } },
            },
        });

        if (!session) return notFoundResponse("Session not found");

        return successResponse(session);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        if (message.includes("not found")) return notFoundResponse(message);
        console.error("[Sessions GET/:id]", error);
        return serverErrorResponse();
    }
}

// PUT /api/sessions/[sessionId] — update session (org-scoped)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { sessionId } = await params;
        await verifySessionOrgAccess(user, sessionId);

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

        await logActivity({
            userId: user.id,
            orgId: user.orgId,
            action: "UPDATE_SESSION",
            entityType: "Session",
            entityId: sessionId,
            details: { sessionNumber: session.sessionNumber }
        });

        return successResponse(session);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Sessions PUT/:id]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/sessions/[sessionId] — delete session (org-scoped)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { sessionId } = await params;
        await verifySessionOrgAccess(user, sessionId);

        await prisma.interviewSession.delete({ where: { id: sessionId } });

        await logActivity({
            userId: user.id,
            orgId: user.orgId,
            action: "DELETE_SESSION",
            entityType: "Session",
            entityId: sessionId,
        });

        return successResponse({ deleted: true, sessionId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        if (message.includes("not found")) return notFoundResponse(message);
        console.error("[Sessions DELETE/:id]", error);
        return serverErrorResponse();
    }
}
