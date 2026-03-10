import { hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { successResponse, serverErrorResponse } from "@/lib/auth/responses";

const DEFAULT_SUPER_ADMIN_EMAIL = "admin@kaizen.ai";
const DEFAULT_SUPER_ADMIN_PASSWORD = "K@123izen";

/**
 * GET /api/super-admin/seed
 * Auto-seeds a default SuperAdmin if none exists.
 * Called on startup or manually.
 */
export async function GET() {
    try {
        const existingCount = await prisma.superAdmin.count();

        if (existingCount > 0) {
            return successResponse({ seeded: false, message: "SuperAdmin already exists" });
        }

        const hashedPassword = await hash(DEFAULT_SUPER_ADMIN_PASSWORD, 12);

        const admin = await prisma.superAdmin.create({
            data: {
                email: DEFAULT_SUPER_ADMIN_EMAIL,
                password: hashedPassword,
            },
            select: { id: true, email: true, createdAt: true },
        });

        console.log(`[SuperAdmin Seed] Created default SuperAdmin: ${admin.email}`);

        return successResponse({ seeded: true, admin }, 201);
    } catch (error) {
        console.error("[SuperAdmin Seed]", error);
        return serverErrorResponse();
    }
}
