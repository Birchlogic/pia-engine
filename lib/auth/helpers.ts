import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { NextResponse } from "next/server";

export type SessionUser = {
    id: string;
    email: string;
    name: string;
    role: "admin" | "senior_assessor" | "analyst";
    orgId: string | null;
};

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

export function unauthorizedResponse() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
