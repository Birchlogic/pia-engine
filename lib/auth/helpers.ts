import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { verifySuperAdminToken, extractBearerToken, type SuperAdminJWTPayload } from "@/lib/auth/jwt";
import { unauthorizedResponse, forbiddenResponse } from "@/lib/auth/responses";
import prisma from "@/lib/db/prisma";

// ─── Types ───

export type SessionUser = {
    id: string;
    email: string;
    name: string;
    role: "admin" | "senior_assessor" | "analyst";
    orgId: string | null;
};

// ─── NextAuth Session Helpers ───

export async function getSession() {
    return await getServerSession(authOptions);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
    const session = await getSession();
    if (!session?.user) return null;
    return session.user as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) {
        throw new Error("Unauthorized");
    }
    return user;
}

export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser> {
    const user = await requireAuth();
    if (!roles.includes(user.role)) {
        throw new Error("Insufficient permissions");
    }
    return user;
}

// ─── Org Isolation Guards ───

/**
 * Verifies the authenticated user belongs to the given orgId.
 * Returns the user if valid, throws otherwise.
 */
export async function requireOrgMatch(user: SessionUser, orgId: string): Promise<SessionUser> {
    if (!user.orgId) {
        throw new Error("User is not assigned to any organization");
    }
    if (user.orgId !== orgId) {
        throw new Error("Access denied: organization mismatch");
    }
    return user;
}

/**
 * Validates that a project belongs to the user's organization.
 * Returns the project or throws.
 */
export async function requireProjectOrgAccess(user: SessionUser, projectId: string) {
    if (!user.orgId) {
        throw new Error("User is not assigned to any organization");
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, orgId: true },
    });

    if (!project) {
        throw new Error("Project not found");
    }

    if (project.orgId !== user.orgId) {
        throw new Error("Access denied: project belongs to a different organization");
    }

    return project;
}

/**
 * Checks the user's project-level role in the ProjectMember table.
 * minRole hierarchy: owner > editor > viewer
 */
export async function requireProjectAccess(
    userId: string,
    projectId: string,
    minRole: "viewer" | "editor" | "owner" = "viewer"
) {
    const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });

    if (!membership) {
        throw new Error("Access denied: not a member of this project");
    }

    const roleHierarchy: Record<string, number> = {
        viewer: 1,
        editor: 2,
        owner: 3,
    };

    if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
        throw new Error(`Access denied: requires at least '${minRole}' role on this project`);
    }

    return membership;
}

/**
 * Validates vertical → project → org chain belongs to the user's org.
 */
export async function requireVerticalOrgAccess(user: SessionUser, verticalId: string) {
    if (!user.orgId) {
        throw new Error("User is not assigned to any organization");
    }

    const vertical = await prisma.vertical.findUnique({
        where: { id: verticalId },
        select: {
            id: true,
            projectId: true,
            project: { select: { orgId: true } },
        },
    });

    if (!vertical) {
        throw new Error("Vertical not found");
    }

    if (vertical.project.orgId !== user.orgId) {
        throw new Error("Access denied: vertical belongs to a different organization");
    }

    return vertical;
}

// ─── Super Admin Guard ───

/**
 * Extracts and verifies SuperAdmin JWT from the Authorization header.
 * Returns the admin payload or null.
 */
export async function requireSuperAdmin(
    request: Request
): Promise<SuperAdminJWTPayload> {
    const token = extractBearerToken(request);
    if (!token) {
        throw new Error("Missing Authorization header");
    }
    return await verifySuperAdminToken(token);
}

// ─── Legacy Response Helpers (kept for backward compat) ───

export { unauthorizedResponse, forbiddenResponse };
