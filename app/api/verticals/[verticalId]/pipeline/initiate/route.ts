import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { getSignedUrl } from "@/lib/supabase/client";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://100.53.49.231:8000";

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

        const payload = {
            session_id: verticalId,
            department: vertical.name,
            files: fileUrls,
            use_rlm: useRlm,
            aggressive_processing: aggressiveProcessing
        };

        console.log("[Pipeline Initiate] Sending to Python backend:", JSON.stringify(payload, null, 2));

        const res = await fetch(`${PIPELINE_API}/api/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.detail || errData.message || "Failed to start pipeline." },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error communicating with Pipeline API:", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Pipeline API" },
            { status: 500 }
        );
    }
}
