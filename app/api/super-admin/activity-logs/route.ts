import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";

// GET /api/super-admin/activity-logs — fetch paginated activity logs
export async function GET(request: Request) {
    try {
        // Ensure the request comes from a Super Admin
        await requireSuperAdmin(request);

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const orgId = searchParams.get("orgId");
        const userId = searchParams.get("userId");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "100");
        const skip = (page - 1) * limit;

        if (action === "summary") {
            // @ts-ignore: Prisma client cache hasn't picked up the activityLogs relation yet
            const usersWithLogs = await prisma.user.findMany({
                where: { activityLogs: { some: {} } },
                include: {
                    organization: true,
                    _count: { select: { activityLogs: true } }
                },
                orderBy: { name: "asc" }
            });

            // Group by organization
            const orgGroups: Record<string, { orgId: string, orgName: string, users: any[] }> = {};
            
            usersWithLogs.forEach((user: any) => {
                const oId = user.orgId || "SYSTEM";
                const oName = user.organization?.name || "System Operations";
                
                if (!orgGroups[oId]) {
                    orgGroups[oId] = { orgId: oId, orgName: oName, users: [] };
                }
                
                orgGroups[oId].users.push({
                    userId: user.id,
                    userName: user.name,
                    email: user.email,
                    logCount: user._count.activityLogs
                });
            });

            return NextResponse.json({
                success: true,
                data: Object.values(orgGroups).sort((a, b) => a.orgName.localeCompare(b.orgName))
            });
        }

        const where: any = {};
        if (orgId) where.orgId = orgId;
        if (userId) where.userId = userId;

        const logs = await prisma.activityLog.findMany({
            where,
            include: {
                user: { select: { email: true, name: true } },
                organization: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({ success: true, data: logs });
    } catch (error) {
        console.error("[Super Admin Activity Logs GET]", error);
        return NextResponse.json(
            { error: "Internal server error fetching activity logs" },
            { status: 500 }
        );
    }
}
