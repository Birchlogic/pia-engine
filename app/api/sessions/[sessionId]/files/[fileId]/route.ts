import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { getPresignedDownloadUrl, deleteFile } from "@/lib/storage/s3-client";

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

    // Check S3 configuration
    if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY) {
        return NextResponse.json(
            { error: "File download is not configured. Please set S3_ENDPOINT and S3_ACCESS_KEY in your environment." },
            { status: 500 }
        );
    }

    try {
        // Generate signed URL (valid for 1 hour)
        const signedUrl = await getPresignedDownloadUrl(file.storagePath);

        return NextResponse.json({
            id: file.id,
            fileName: file.fileName,
            fileType: file.fileType,
            fileSize: file.fileSizeBytes.toString(),
            mimeType: file.mimeType,
            transcriptionStatus: file.transcriptionStatus,
            transcribedText: file.transcribedText,
            downloadUrl: signedUrl,
            createdAt: file.createdAt,
        });
    } catch (err) {
        console.error("Failed to generate download URL:", err);

        // Check if it's a bucket not found error
        if (err instanceof Error && err.message.includes("bucket") && err.message.includes("not found")) {
            return NextResponse.json(
                { error: "Storage bucket not found. Please create it in your MinIO/S3 project." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: "Failed to generate download URL. Please try again." },
            { status: 500 }
        );
    }
}

export async function DELETE(
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

    try {
        // Delete from S3 storage
        await deleteFile(file.storagePath);

        // Delete from database
        await prisma.sessionFile.delete({
            where: { id: fileId },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("Failed to delete file:", err);
        return NextResponse.json(
            { error: "Failed to delete file. Please try again." },
            { status: 500 }
        );
    }
}
