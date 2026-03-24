import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.orgId) return unauthorizedResponse();

        const { projectId } = await params;

        // Verify project belongs to user's org
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } } },
        });

        if (!project || project.orgId !== user.orgId) {
            return forbiddenResponse("Project not found or access denied");
        }

        // We also want to return all users in the org to allow assignment
        const orgUsers = await prisma.user.findMany({
            where: { orgId: user.orgId, isActive: true },
            select: { id: true, name: true, email: true, role: true },
        });

        return successResponse({
            members: project.members.map(m => ({
                id: m.id,
                userId: m.userId,
                role: m.role,
                name: m.user.name,
                email: m.user.email,
                platformRole: m.user.role,
            })),
            availableUsers: orgUsers.filter(ou => !project.members.some(pm => pm.userId === ou.id)),
        });
    } catch (error) {
        console.error("[Project Members GET]", error);
        return serverErrorResponse();
    }
}

const assignMemberSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(["senior_assessor", "analyst"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.orgId) return unauthorizedResponse();

        // Only org admins or project owners can assign members
        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can assign project members");
        }

        const { projectId } = await params;

        const body = await request.json();
        const parsed = assignMemberSchema.safeParse(body);
        if (!parsed.success) {
            return errorResponse("Invalid input data", 400);
        }

        const { userId, role } = parsed.data;

        // Verify project belongs to user's org
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.orgId !== user.orgId) {
            return forbiddenResponse("Project not found or access denied");
        }

        // Verify the user being added belongs to the same org
        const targetUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!targetUser || targetUser.orgId !== user.orgId) {
            return forbiddenResponse("User not found in your organization");
        }

        const member = await prisma.projectMember.create({
            data: {
                projectId,
                userId,
                role,
            },
            include: { user: { select: { id: true, name: true, email: true, role: true } } },
        });

        // Track Activity
        await logActivity({
            userId: user.id,
            orgId: user.orgId,
            action: "ASSIGN_PROJECT",
            entityType: "Project",
            entityId: projectId,
            details: { assignedUser: targetUser.email, role }
        });

        return successResponse({
            id: member.id,
            userId: member.userId,
            role: member.role,
            name: member.user.name,
            email: member.user.email,
            platformRole: member.user.role,
        }, 201);
    } catch (error) {
        console.error("[Project Members POST]", error);
        return serverErrorResponse();
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.orgId) return unauthorizedResponse();

        // Only org admins or project owners can remove members
        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can manage project members");
        }

        const { projectId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return errorResponse("Missing userId", 400);
        }

        // Verify project
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.orgId !== user.orgId) {
            return forbiddenResponse("Project not found or access denied");
        }

        const deleted = await prisma.projectMember.deleteMany({
            where: {
                projectId,
                userId,
                // Optional logic: prevent deleting the last owner, etc.
            }
        });

        if (deleted.count > 0) {
            // Track Activity
            await logActivity({
                userId: user.id,
                orgId: user.orgId,
                action: "REMOVE_PROJECT",
                entityType: "Project",
                entityId: projectId,
                details: { removedUserId: userId }
            });
        }

        return successResponse({ success: true }, 200);
    } catch (error) {
        console.error("[Project Members DELETE]", error);
        return serverErrorResponse();
    }
}
