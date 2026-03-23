import prisma from "@/lib/db/prisma";
import { getCurrentUser, requireVerticalOrgAccess } from "@/lib/auth/helpers";
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";
import { logActivity } from "@/lib/activity";

// GET /api/verticals/[verticalId] — vertical detail (org-scoped)
export async function GET(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { verticalId } = await params;

        // Verify vertical → project → org chain
        await requireVerticalOrgAccess(user, verticalId);

        const vertical = await prisma.vertical.findUnique({
            where: { id: verticalId },
            include: {
                project: {
                    select: { id: true, name: true, organization: { select: { id: true, name: true } } },
                },
                sessions: {
                    orderBy: { sessionDate: "desc" },
                    include: {
                        files: {
                            select: {
                                id: true,
                                fileName: true,
                                fileSizeBytes: true,
                                fileType: true,
                                mimeType: true,
                                transcriptionStatus: true,
                                createdAt: true,
                            },
                            orderBy: { createdAt: "desc" },
                        },
                        _count: { select: { files: true } },
                        creator: { select: { name: true } },
                    },
                },
                _count: { select: { sessions: true } },
            },
        });

        if (!vertical) return notFoundResponse("Vertical not found");

        // Handle BigInt serialization
        const serializedVertical = JSON.parse(
            JSON.stringify(vertical, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
            )
        );

        return successResponse(serializedVertical);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Verticals GET/:id]", error);
        return serverErrorResponse();
    }
}

// PUT /api/verticals/[verticalId] — update vertical (org-scoped)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { verticalId } = await params;
        await requireVerticalOrgAccess(user, verticalId);

        const body = await request.json();

        const vertical = await prisma.vertical.update({
            where: { id: verticalId },
            data: {
                name: body.name,
                description: body.description,
                headName: body.headName,
                headRole: body.headRole,
                headContact: body.headContact,
                assessmentStatus: body.assessmentStatus,
            },
        });

        await logActivity({
            userId: user.id,
            orgId: user.orgId,
            action: "UPDATE_VERTICAL",
            entityType: "Vertical",
            entityId: verticalId,
            details: { name: vertical.name }
        });

        return successResponse(vertical);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Verticals PUT/:id]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/verticals/[verticalId] — delete vertical (org-scoped)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { verticalId } = await params;
        await requireVerticalOrgAccess(user, verticalId);

        await prisma.vertical.delete({ where: { id: verticalId } });

        await logActivity({
            userId: user.id,
            orgId: user.orgId,
            action: "DELETE_VERTICAL",
            entityType: "Vertical",
            entityId: verticalId,
        });

        return successResponse({ deleted: true, verticalId });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("different organization")) return forbiddenResponse(message);
        console.error("[Verticals DELETE/:id]", error);
        return serverErrorResponse();
    }
}
