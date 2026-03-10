import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireProjectOrgAccess } from "@/lib/auth/helpers";
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/projects/[projectId] — project detail (org-scoped)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { projectId } = await params;

        // Verify project belongs to user's org
        await requireProjectOrgAccess(user, projectId);

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: {
                organization: { select: { id: true, name: true } },
                verticals: {
                    orderBy: { sortOrder: "asc" },
                    include: { _count: { select: { sessions: true } } },
                },
                members: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                _count: { select: { verticals: true, members: true } },
            },
        });

        if (!project) return notFoundResponse("Project not found");

        return successResponse(project);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Projects GET/:id]", error);
        return serverErrorResponse();
    }
}

// PUT /api/projects/[projectId] — update project (org-scoped, admin or project owner)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { projectId } = await params;
        await requireProjectOrgAccess(user, projectId);

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

        return successResponse(project);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Projects PUT/:id]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/projects/[projectId] — delete project (org-scoped, admin only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can delete projects");
        }

        const { projectId } = await params;
        await requireProjectOrgAccess(user, projectId);

        await prisma.project.delete({ where: { id: projectId } });

        return successResponse({ deleted: true, projectId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Projects DELETE/:id]", error);
        return serverErrorResponse();
    }
}
