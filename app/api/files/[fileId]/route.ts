import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { unlink } from "fs/promises";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ fileId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { fileId } = await params;

    const file = await prisma.sessionFile.findUnique({
        where: { id: fileId },
    });

    if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from database
    await prisma.sessionFile.delete({
        where: { id: fileId },
    });

    // Delete from disk
    try {
        await unlink(file.storagePath);
    } catch (error) {
        console.error("Failed to delete file from disk:", error);
        // Continue even if disk delete fails, as DB record is gone
    }

    return NextResponse.json({ success: true });
}
