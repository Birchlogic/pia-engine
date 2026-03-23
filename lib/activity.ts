import prisma from "@/lib/db/prisma";

export interface LogActivityParams {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: any;
    orgId?: string;
}

/**
 * Centrally log user activity across the platform.
 * Fails silently to prevent breaking application flow.
 */
export async function logActivity({
    userId,
    action,
    entityType,
    entityId,
    details,
    orgId,
}: LogActivityParams) {
    try {
        let finalOrgId = orgId;

        // If orgId wasn't explicitly provided, lookup the user's org
        if (!finalOrgId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { orgId: true },
            });
            if (user?.orgId) {
                finalOrgId = user.orgId;
            }
        }

        await prisma.activityLog.create({
            data: {
                userId,
                orgId: finalOrgId,
                action,
                entityType,
                entityId,
                details: details ? (typeof details === "string" ? JSON.parse(details) : details) : {},
            },
        });
    } catch (error) {
        // We log the error but do NOT throw. Activity logging should not break the app.
        console.error("[ActivityLogger] Failed to log activity:", error);
    }
}
