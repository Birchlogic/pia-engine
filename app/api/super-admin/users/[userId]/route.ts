import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";

// DELETE /api/super-admin/users/[userId] — soft-delete (deactivate) a user
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { userId } = await params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, isActive: true },
        });

        if (!user) return notFoundResponse("User not found");

        if (!user.isActive) {
            return errorResponse("User is already deactivated", 400);
        }

        await prisma.user.update({
            where: { id: userId },
            data: { isActive: false },
        });

        return successResponse({ deactivated: true, userId, email: user.email });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin RemoveUser]", error);
        return serverErrorResponse();
    }
}
