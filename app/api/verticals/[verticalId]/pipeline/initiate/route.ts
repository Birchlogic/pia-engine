import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { getSignedUrl } from "@/lib/supabase/client";
import { SignJWT } from "jose";
import { logActivity } from "@/lib/activity";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://35.170.54.12:8000";

function getPayloadSecret(): Uint8Array {
    const secret = process.env.PAYLOAD_TOKEN;
    if (!secret) {
        throw new Error("PAYLOAD_TOKEN is not set in environment variables");
    }
    return new TextEncoder().encode(secret);
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    let useRlm = false;
    let aggressiveProcessing = true;

    try {
        const body = await request.json();
        if (body.use_rlm !== undefined) useRlm = body.use_rlm;
        if (body.aggressive_processing !== undefined) aggressiveProcessing = !!body.aggressive_processing;
    } catch {
        // Body is optional
    }

    const vertical = await prisma.vertical.findUnique({
        where: { id: verticalId },
        include: {
            sessions: {
                where: { status: "finalized" },
                include: { files: true },
            },
        },
    });

    if (!vertical || !vertical.sessions || vertical.sessions.length === 0) {
        return NextResponse.json(
            { error: "Vertical not found or no finalized sessions." },
            { status: 404 }
        );
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

    // Gather signed URLs for every uploaded file across finalized sessions
    const fileUrls: string[] = [];
    for (const session of vertical.sessions) {
        for (const file of session.files) {
            if (file.storagePath) {
                try {
                    const url = await getSignedUrl(file.storagePath);
                    fileUrls.push(url);
                } catch (err) {
                    console.error(`Failed to get signed URL for ${file.fileName}:`, err);
                }
            }
        }
    }

    try {
        // Delete existing session on the Python backend first (it treats session_id as unique)
        try {
            await fetch(`${PIPELINE_API}/api/session/${verticalId}`, {
                method: "DELETE",
            });
        } catch (deleteErr) {
            // Best-effort: don't block initiation if delete fails
            console.warn("Pre-delete of existing session failed (non-blocking):", deleteErr);
        }

        const payloadData = {
            session_id: verticalId,
            project_id: vertical.projectId,
            department: vertical.name,
            files: fileUrls,
            use_rlm: useRlm,
            aggressive_processing: aggressiveProcessing,
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
            projectId: vertical.projectId
        };

        console.log(`[Pipeline Initiate] Sending signed JWT token to Python backend. Token payload:`, finalBody);

        const res = await fetch(`${PIPELINE_API}/api/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(finalBody),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.detail || errData.message || "Failed to start pipeline." },
                { status: res.status }
            );
        }

        const data = await res.json();
        
        await logActivity({
            userId: user.id,
            action: "INITIATE_PIPELINE",
            entityType: "Vertical",
            entityId: verticalId,
            details: { useRlm, aggressiveProcessing }
        });

        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        if (err instanceof Error && err.message.includes("PAYLOAD_TOKEN")) {
            console.error("Configuration error:", err.message);
            return NextResponse.json(
                { error: "Server configuration error (missing PAYLOAD_TOKEN)." },
                { status: 500 }
            );
        }
        console.error("Error communicating with Pipeline API:", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Pipeline API" },
            { status: 500 }
        );
    }
}
