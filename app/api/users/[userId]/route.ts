import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return unauthorizedResponse();

        if (!currentUser.orgId) {
            return errorResponse("User is not assigned to any organization", 403);
        }

        if (currentUser.role !== "admin") {
            return forbiddenResponse("Only administrators can remove users from the organization");
        }

        const { userId: targetUserId } = await params;

        // Prevent self-deletion
        if (currentUser.id === targetUserId) {
            return errorResponse("You cannot remove your own account", 400);
        }

        // Check if user exists and belongs to the same org
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { orgId: true }
        });

        if (!targetUser) {
            return errorResponse("User not found", 404);
        }

        if (targetUser.orgId !== currentUser.orgId) {
            return forbiddenResponse("You can only remove users from your own organization");
        }

        // Delete the user
        // Note: ProjectMemberships and other relations set to Cascade will be deleted automatically
        await prisma.user.delete({
            where: { id: targetUserId }
        });

        return successResponse({ deleted: true }, 200);
    } catch (error) {
        console.error("[Users DELETE]", error);
        return serverErrorResponse();
    }
}
