import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/auth/responses";

// PATCH /api/super-admin/llm-providers/[providerId] — update provider or activate it
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ providerId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { providerId } = await params;
        const body = await request.json();

        const existing = await prisma.llmProvider.findUnique({
            where: { id: providerId },
        });

        if (!existing) {
            return errorResponse("Provider not found", 404);
        }

        // If activating this provider, deactivate all others in a transaction
        if (body.status === "ACTIVE") {
            await prisma.$transaction([
                prisma.llmProvider.updateMany({
                    where: { status: "ACTIVE" },
                    data: { status: "INACTIVE" },
                }),
                prisma.llmProvider.update({
                    where: { id: providerId },
                    data: {
                        status: "ACTIVE",
                        ...(body.model ? { model: body.model } : {}),
                        ...(body.apiKey ? { apiKey: body.apiKey } : {}),
                    },
                }),
            ]);

            const updated = await prisma.llmProvider.findUnique({
                where: { id: providerId },
                include: { admin: { select: { email: true } } },
            });

            return successResponse({
                ...updated,
                apiKey: `${"•".repeat(20)}${updated!.apiKey.slice(-4)}`,
            });
        }

        // Normal update (model, apiKey, or deactivate)
        const updateData: Record<string, unknown> = {};
        if (body.model) updateData.model = body.model;
        if (body.apiKey) updateData.apiKey = body.apiKey;
        if (body.status === "INACTIVE") updateData.status = "INACTIVE";

        const updated = await prisma.llmProvider.update({
            where: { id: providerId },
            data: updateData,
            include: { admin: { select: { email: true } } },
        });

        return successResponse({
            ...updated,
            apiKey: `${"•".repeat(20)}${updated.apiKey.slice(-4)}`,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin UpdateLlmProvider]", error);
        return serverErrorResponse();
    }
}

// DELETE /api/super-admin/llm-providers/[providerId] — delete a provider (only if INACTIVE)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ providerId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { providerId } = await params;

        const existing = await prisma.llmProvider.findUnique({
            where: { id: providerId },
        });

        if (!existing) {
            return errorResponse("Provider not found", 404);
        }

        if (existing.status === "ACTIVE") {
            return errorResponse("Cannot delete an active provider. Deactivate it first.", 400);
        }

        await prisma.llmProvider.delete({
            where: { id: providerId },
        });

        return successResponse({ deleted: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin DeleteLlmProvider]", error);
        return serverErrorResponse();
    }
}
