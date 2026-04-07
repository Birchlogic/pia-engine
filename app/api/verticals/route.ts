import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireProjectOrgAccess } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { validateBody, createVerticalSchema } from "@/lib/validations/schemas";
import { logActivity } from "@/lib/activity";

// GET /api/verticals?projectId=xxx — list verticals (org-scoped)
export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");

        if (!projectId) {
            return errorResponse("projectId is required", 400);
        }

        // Verify project belongs to user's org
        await requireProjectOrgAccess(user, projectId);

        const verticals = await prisma.vertical.findMany({
            where: { projectId },
            include: {
                _count: { select: { sessions: true } },
            },
            orderBy: { sortOrder: "asc" },
        });

        return successResponse(verticals);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        if (message.includes("not found")) return errorResponse(message, 404);
        console.error("[Verticals GET]", error);
        return serverErrorResponse();
    }
}

// POST /api/verticals — create vertical (org-scoped)
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const validation = validateBody(createVerticalSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const { projectId, name, description, headName, headRole, headContact } = validation.data;

        // Verify project belongs to user's org
        await requireProjectOrgAccess(user, projectId);

        // Idempotency: avoid creating duplicate verticals for the same project/name
        const existing = await prisma.vertical.findFirst({
            where: {
                projectId,
                name: { equals: name, mode: "insensitive" },
            },
        });
        if (existing) {
            return successResponse(existing, 200);
        }

        // Get next sort order
        const maxSort = await prisma.vertical.aggregate({
            where: { projectId },
            _max: { sortOrder: true },
        });

        const vertical = await prisma.vertical.create({
            data: {
                projectId,
                name,
                description: description || null,
                headName: headName || null,
                headRole: headRole || null,
                headContact: headContact || null,
                sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
                createdById: user.id,
            },
        });

        await logActivity({
            userId: user.id,
            action: "CREATE_VERTICAL",
            entityType: "Vertical",
            entityId: vertical.id,
            details: { name: vertical.name, projectId }
        });

        return successResponse(vertical, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        if (message.includes("not found")) return errorResponse(message, 404);
        console.error("[Verticals POST]", error);
        return serverErrorResponse();
    }
}
