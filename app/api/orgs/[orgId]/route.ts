import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireOrgMatch } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/orgs/[orgId] — org details (only for own org)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { orgId } = await params;
        await requireOrgMatch(user, orgId);

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                projects: {
                    include: {
                        _count: { select: { verticals: true } },
                        creator: { select: { name: true } },
                    },
                    orderBy: { createdAt: "desc" },
                },
                creator: { select: { name: true } },
            },
        });

        if (!org) return notFoundResponse("Organization not found");

        return successResponse(org);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("mismatch")) return forbiddenResponse(message);
        console.error("[Orgs GET/:id]", error);
        return serverErrorResponse();
    }
}

// PUT /api/orgs/[orgId] — update own org (admin only)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { orgId } = await params;
        await requireOrgMatch(user, orgId);

        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can update organization settings");
        }

        const body = await request.json();

        const org = await prisma.organization.update({
            where: { id: orgId },
            data: {
                name: body.name,
                industry: body.industry,
                jurisdiction: body.jurisdiction,
                regulatoryScope: body.regulatoryScope,
                sizeBand: body.sizeBand,
            },
        });

        return successResponse(org);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("mismatch")) return forbiddenResponse(message);
        console.error("[Orgs PUT/:id]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/orgs/[orgId] — removed, use SuperAdmin API instead
