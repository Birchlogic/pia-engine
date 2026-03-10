import { hash } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/auth/responses";
import { validateBody, createOrgSchema } from "@/lib/validations/schemas";

// GET /api/super-admin/orgs — list all organizations
export async function GET(request: Request) {
    try {
        await requireSuperAdmin(request);

        const orgs = await prisma.organization.findMany({
            include: {
                _count: { select: { projects: true, users: true } },
                creator: { select: { name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return successResponse(orgs);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin ListOrgs]", error);
        return serverErrorResponse();
    }
}

// POST /api/super-admin/orgs — create organization + admin user
export async function POST(request: Request) {
    try {
        await requireSuperAdmin(request);

        const body = await request.json();
        const validation = validateBody(createOrgSchema, body);

        if ("error" in validation) {
            return errorResponse(validation.error, 400);
        }

        const { orgName, industry, jurisdiction, regulatoryScope, sizeBand, projectLimit, adminUser } = validation.data;

        // Check if admin email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: adminUser.email },
        });

        if (existingUser) {
            return errorResponse("A user with this email already exists", 409);
        }

        const hashedPassword = await hash(adminUser.password, 12);

        // Atomic transaction: create org + admin user
        const result = await prisma.$transaction(async (tx) => {
            // We need to create the user first (for the OrgCreatedBy relation)
            // but the user needs an orgId. So we create user without orgId first.
            const tempUser = await tx.user.create({
                data: {
                    name: adminUser.name,
                    email: adminUser.email,
                    password: hashedPassword,
                    role: "admin",
                },
            });

            const org = await tx.organization.create({
                data: {
                    name: orgName,
                    industry: industry || null,
                    jurisdiction: jurisdiction || null,
                    regulatoryScope: regulatoryScope || [],
                    sizeBand: sizeBand || null,
                    projectLimit,
                    createdById: tempUser.id,
                },
            });

            // Now update the user with the orgId
            const user = await tx.user.update({
                where: { id: tempUser.id },
                data: { orgId: org.id },
                select: { id: true, email: true, name: true, role: true },
            });

            return { org, user };
        });

        return successResponse(
            {
                organization: {
                    id: result.org.id,
                    name: result.org.name,
                },
                adminUser: result.user,
            },
            201
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin CreateOrg]", error);
        return serverErrorResponse();
    }
}
