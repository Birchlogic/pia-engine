import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ projectId: string; memberId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user || !user.orgId) return unauthorizedResponse();

        if (user.role !== "admin") {
            return forbiddenResponse("Only admins can manage project members");
        }

        const { projectId, memberId } = await params;

        // Verify project belongs to user's org
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.orgId !== user.orgId) {
            return forbiddenResponse("Project not found or access denied");
        }

        // Verify member belongs to this project
        const member = await prisma.projectMember.findUnique({ where: { id: memberId } });
        if (!member || member.projectId !== projectId) {
            return errorResponse("Member not found in this project", 404);
        }

        // Cannot remove the owner or the last admin if we wanted to be strictly safe, 
        // but for now let's just allow it or prevent removing oneself if they are the only admin
        if (member.role === "owner" && member.userId === user.id) {
            return errorResponse("Cannot remove yourself as the project owner", 400);
        }

        await prisma.projectMember.delete({ where: { id: memberId } });

        return successResponse({ deleted: true, memberId });
    } catch (error) {
        console.error("[Project Members DELETE]", error);
        return serverErrorResponse();
    }
}
