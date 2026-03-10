import { compare } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { signSuperAdminToken, extractBearerToken, verifySuperAdminToken } from "@/lib/auth/jwt";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/auth/responses";
import { validateBody, superAdminLoginSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = validateBody(superAdminLoginSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const { email, password } = validation.data;

        const admin = await prisma.superAdmin.findUnique({
            where: { email },
        });

        if (!admin) {
            return unauthorizedResponse("Invalid credentials");
        }

        const isValid = await compare(password, admin.password);
        if (!isValid) {
            return unauthorizedResponse("Invalid credentials");
        }

        const token = await signSuperAdminToken(admin.id, admin.email);

        return successResponse({ token, email: admin.email }, 200);
    } catch (error) {
        console.error("[SuperAdmin Login]", error);
        return errorResponse("Internal server error", 500);
    }
}
