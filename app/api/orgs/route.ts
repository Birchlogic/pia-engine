import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/orgs — user only sees their own organization
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        if (!user.orgId) {
            return errorResponse("User is not assigned to any organization", 403);
        }

        const org = await prisma.organization.findUnique({
            where: { id: user.orgId },
            include: {
                _count: { select: { projects: true, users: true } },
                creator: { select: { name: true } },
            },
        });

        if (!org) {
            return errorResponse("Organization not found", 404);
        }

        // Return as array for backward compatibility with frontend
        return successResponse([org]);
    } catch (error) {
        console.error("[Orgs GET]", error);
        return serverErrorResponse();
    }
}

// POST removed — org creation is SuperAdmin-only via /api/super-admin/orgs
