import { hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, notFoundResponse, serverErrorResponse } from "@/lib/auth/responses";
import { validateBody, addUserSchema } from "@/lib/validations/schemas";

// GET /api/super-admin/orgs/[orgId]/users — list users in org
export async function GET(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return notFoundResponse("Organization not found");

        const users = await prisma.user.findMany({
            where: { orgId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
                _count: { select: { createdSessions: true, createdProjects: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return successResponse(users);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin ListOrgUsers]", error);
        return serverErrorResponse();
    }
}

// POST /api/super-admin/orgs/[orgId]/users — add user to org
export async function POST(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        await requireSuperAdmin(request);
        const { orgId } = await params;

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) return notFoundResponse("Organization not found");

        const body = await request.json();
        const validation = validateBody(addUserSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const { name, email, password, role } = validation.data;

        // Check for duplicate email
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return errorResponse("A user with this email already exists", 409);
        }

        const hashedPassword = await hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                orgId,
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });

        return successResponse(user, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin AddUser]", error);
        return serverErrorResponse();
    }
}
