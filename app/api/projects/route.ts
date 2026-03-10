import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireOrgMatch } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { validateBody, createProjectSchema } from "@/lib/validations/schemas";

// GET /api/projects — list projects for user's org
export async function GET(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        if (!user.orgId) {
            return errorResponse("User is not assigned to any organization", 403);
        }

        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get("orgId");

        // If orgId is provided, verify it matches user's org
        if (orgId && orgId !== user.orgId) {
            return forbiddenResponse("Access denied: organization mismatch");
        }

        const projects = await prisma.project.findMany({
            where: { orgId: user.orgId },
            include: {
                _count: { select: { verticals: true, members: true } },
                creator: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return successResponse(projects);
    } catch (error) {
        console.error("[Projects GET]", error);
        return serverErrorResponse();
    }
}

// POST /api/projects — create project (admin only, auto-adds creator as owner)
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can create projects");
        }

        const body = await request.json();
        const validation = validateBody(createProjectSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const { orgId, name, description, applicableRegulations, assessmentType, targetCompletionDate } = validation.data;

        // Enforce org isolation
        await requireOrgMatch(user, orgId);

        // Check project limit
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { projectLimit: true, _count: { select: { projects: true } } }
        });

        if (!org) return errorResponse("Organization not found", 404);
        if (org._count.projects >= org.projectLimit) {
            return forbiddenResponse(`Project limit reached (${org.projectLimit} projects max). Please upgrade or contact support.`);
        }

        // Atomic: create project + add creator as owner member
        const result = await prisma.$transaction(async (tx) => {
            const project = await tx.project.create({
                data: {
                    orgId,
                    name,
                    description: description || null,
                    applicableRegulations: applicableRegulations || [],
                    assessmentType: assessmentType || "full_pia",
                    targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
                    createdById: user.id,
                },
            });

            // Auto-create project membership for creator as owner
            await tx.projectMember.create({
                data: {
                    projectId: project.id,
                    userId: user.id,
                    role: "owner",
                },
            });

            return project;
        });

        return successResponse(result, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("mismatch")) return forbiddenResponse(message);
        console.error("[Projects POST]", error);
        return serverErrorResponse();
    }
}
