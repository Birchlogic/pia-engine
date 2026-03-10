import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";
import { z } from "zod";

const assignUserSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(["admin", "senior_assessor", "analyst"]).optional(),
});

// POST /api/super-admin/orgs/[orgId]/assign-user
export async function POST(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return notFoundResponse("Organization not found");

        const body = await request.json();
        const parsed = assignUserSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid input data", 400);
        }

        const { userId, role } = parsed.data;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return notFoundResponse("User not found");

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                orgId,
                role: role || user.role, // Update role if provided, otherwise keep existing
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                orgId: true,
            },
        });

        return successResponse(updatedUser);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin AssignUser]", error);
        return serverErrorResponse();
    }
}
