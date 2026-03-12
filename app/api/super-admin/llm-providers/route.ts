import prisma from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/helpers";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/auth/responses";

// GET /api/super-admin/llm-providers — list all providers
export async function GET(request: Request) {
    try {
        const admin = await requireSuperAdmin(request);

        const providers = await prisma.llmProvider.findMany({
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
            include: {
                admin: { select: { email: true } },
            },
        });

        // Mask API keys — show only last 4 chars
        const masked = providers.map((p) => ({
            ...p,
            apiKey: `${"•".repeat(20)}${p.apiKey.slice(-4)}`,
        }));

        return successResponse(masked);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin ListLlmProviders]", error);
        return serverErrorResponse();
    }
}

// POST /api/super-admin/llm-providers — create a new provider config
export async function POST(request: Request) {
    try {
        const admin = await requireSuperAdmin(request);
        const body = await request.json();

        const { type, model, apiKey } = body;

        if (!type || !model || !apiKey) {
            return errorResponse("type, model, and apiKey are required", 400);
        }

        const validTypes = ["CLAUDE", "OPENAI", "OPENROUTER"];
        if (!validTypes.includes(type)) {
            return errorResponse(`type must be one of: ${validTypes.join(", ")}`, 400);
        }

        const provider = await prisma.llmProvider.create({
            data: {
                type,
                model,
                apiKey,
                addedBy: admin.adminId,
            },
        });

        return successResponse(
            {
                ...provider,
                apiKey: `${"•".repeat(20)}${provider.apiKey.slice(-4)}`,
            },
            201
        );
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (message.includes("Authorization") || message.includes("token")) {
            return errorResponse(message, 401);
        }
        console.error("[SuperAdmin CreateLlmProvider]", error);
        return serverErrorResponse();
    }
}
