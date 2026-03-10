import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/super-admin/users — list all platform users
export async function GET(request: Request) {
    try {
        await requireSuperAdmin(request);

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                orgId: true,
                organization: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return successResponse(users);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin GetUsers]", error);
        return serverErrorResponse();
    }
}
