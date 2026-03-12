import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireVerticalOrgAccess } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { validateBody, createSessionSchema } from "@/lib/validations/schemas";

// POST /api/sessions — create session (org-scoped via vertical→project→org chain)
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const validation = validateBody(createSessionSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const {
            verticalId,
            sessionDate,
            durationMinutes,
            interviewerNames,
            intervieweeNames,
            intervieweeRoles,
            assessmentCriteriaTags,
            rawTextNotes,
        } = validation.data;

        // Verify vertical → project → org chain matches user's org
        await requireVerticalOrgAccess(user, verticalId);

        /* // Check session limit
        const vertical = await prisma.vertical.findUnique({
            where: { id: verticalId },
            select: { sessionRunLimit: true, _count: { select: { sessions: true } } }
        });

        if (!vertical) return errorResponse("Vertical not found", 404);
        if (vertical._count.sessions >= vertical.sessionRunLimit) {
            return forbiddenResponse(`Session run limit reached (${vertical.sessionRunLimit} sessions max) for this vertical. Please upgrade or contact support.`);
        } */

        // Get next session number
        const maxSession = await prisma.interviewSession.aggregate({
            where: { verticalId },
            _max: { sessionNumber: true },
        });

        const session = await prisma.interviewSession.create({
            data: {
                verticalId,
                sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
                sessionNumber: (maxSession._max.sessionNumber ?? 0) + 1,
                durationMinutes: durationMinutes || null,
                interviewerNames: interviewerNames || [],
                intervieweeNames: intervieweeNames || [],
                intervieweeRoles: intervieweeRoles || [],
                assessmentCriteriaTags: assessmentCriteriaTags || [],
                rawTextNotes: rawTextNotes || null,
                status: "draft",
                createdById: user.id,
            },
        });

        return successResponse(session, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        if (message.includes("not found")) return errorResponse(message, 404);
        console.error("[Sessions POST]", error);
        return serverErrorResponse();
    }
}
