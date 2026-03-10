import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { hash } from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["admin", "senior_assessor", "analyst"]),
});

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        if (!user.orgId) {
            return errorResponse("User is not assigned to any organization", 403);
        }

        // Only admins can view the full user list
        if (user.role !== "admin") {
            return forbiddenResponse("Only administrators can view the organization users");
        }

        const users = await prisma.user.findMany({
            where: { orgId: user.orgId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                _count: {
                    select: { projectMemberships: true }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        return successResponse(users);
    } catch (error) {
        console.error("[Users GET]", error);
        return serverErrorResponse();
    }
}

export async function POST(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) return unauthorizedResponse();

        if (!currentUser.orgId) {
            return errorResponse("User is not assigned to any organization", 403);
        }

        if (currentUser.role !== "admin") {
            return forbiddenResponse("Only administrators can add users to the organization");
        }

        const body = await request.json();
        const result = createUserSchema.safeParse(body);

        if (!result.success) {
            return errorResponse(result.error.errors[0].message, 400);
        }

        const { name, email, password, role } = result.data;

        // Check if email is already in use
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return errorResponse("A user with this email already exists", 400);
        }

        const hashedPassword = await hash(password, 12);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                orgId: currentUser.orgId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        return successResponse(newUser, 201);
    } catch (error) {
        console.error("[Users POST]", error);
        return serverErrorResponse();
    }
}
