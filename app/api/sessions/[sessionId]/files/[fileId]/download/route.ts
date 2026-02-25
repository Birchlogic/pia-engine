import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { getSignedUrl, supabase } from "@/lib/supabase/client";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string; fileId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId, fileId } = await params;

    // Verify session exists
    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
    });
    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get file metadata
    const file = await prisma.sessionFile.findUnique({
        where: { id: fileId, sessionId },
    });
    if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json(
            { error: "File download is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment." },
            { status: 500 }
        );
    }

    try {
        // Generate signed URL (valid for 1 hour)
        const signedUrl = await getSignedUrl(file.storagePath);

        return NextResponse.json({
            url: signedUrl,
            fileName: file.fileName,
            fileSize: file.fileSizeBytes.toString(),
            mimeType: file.mimeType,
        });
    } catch (err) {
        console.error("Failed to generate download URL:", err);

        // Check if it's a bucket not found error
        if (err instanceof Error && err.message.includes("bucket") && err.message.includes("not found")) {
            return NextResponse.json(
                { error: "Storage bucket 'session-files' not found. Please create it in your Supabase project." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate download URL. Please try again." },
            { status: 500 }
        );
    }
}
