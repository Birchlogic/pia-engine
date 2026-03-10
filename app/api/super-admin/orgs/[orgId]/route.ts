import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/super-admin/orgs/[orgId] — org details
export async function GET(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                users: {
                    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                },
                projects: {
                    select: { id: true, name: true, status: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { projects: true, users: true } },
            },
        });

        if (!org) return notFoundResponse("Organization not found");

        return successResponse(org);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin GetOrg]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/super-admin/orgs/[orgId] — cascade delete entire org
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return notFoundResponse("Organization not found");

        // Detach users from this org to avoid Foreign Key constraint violation
        // (Since User.orgId does not have onDelete: Cascade)
        await prisma.user.updateMany({
            where: { orgId },
            data: { orgId: null },
        });

        // Cascade delete: projects -> verticals -> sessions -> files
        // Prisma cascade handles this via schema relations
        await prisma.organization.delete({ where: { id: orgId } });

        return successResponse({ deleted: true, orgId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin DeleteOrg]", error);
        return serverErrorResponse();
    }
}
