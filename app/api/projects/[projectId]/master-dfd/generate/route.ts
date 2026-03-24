import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { SignJWT } from "jose";
import { logActivity } from "@/lib/activity";
import { formatError } from "@/lib/utils";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://127.0.0.1:8000";

function getPayloadSecret(): Uint8Array {
    const secret = process.env.PAYLOAD_TOKEN;
    if (!secret) {
        throw new Error("PAYLOAD_TOKEN is not set in environment variables");
    }
    return new TextEncoder().encode(secret);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { projectId } = await params;

    try {
        const body = await request.json();
        const { ids, projectName } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "No session IDs provided." }, { status: 400 });
        }

        // Get the active LLM Provider configuration
        const activeProvider = await prisma.llmProvider.findFirst({
            where: { status: "ACTIVE" },
        });

        if (!activeProvider) {
            return NextResponse.json(
                { error: "No active LLM provider configured. Please contact the administrator." },
                { status: 400 }
            );
        }

        const payloadData = {
            session_ids: ids,
            project_id: projectId,
            project_name: projectName || "Project Master DFD",
            email: user.email
        };

        const fullPayload = {
            ai_config: {
                type: activeProvider.type,
                model: activeProvider.model,
                apiKey: activeProvider.apiKey,
            },
            data: payloadData
        };

        const token = await new SignJWT(fullPayload as any)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(getPayloadSecret());

        const finalBody = { 
            token,
            email: user.email,
            projectId: projectId
        };

        const res = await fetch(`${PIPELINE_API}/api/master-dfd/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalBody),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const detail = errData.detail || errData.message;
            return NextResponse.json(
                { error: detail ? formatError(detail) : "Failed to start master DFD generation." },
                { status: res.status }
            );
        }

        const data = await res.json();
        
        await logActivity({
            userId: user.id,
            orgId: user.orgId ?? undefined,
            action: "GENERATE_MASTER_DFD",
            entityType: "Project",
            entityId: projectId,
            details: { sessionCount: ids.length }
        });

        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error communicating with Master DFD API:", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Master DFD API" },
            { status: 500 }
        );
    }
}
