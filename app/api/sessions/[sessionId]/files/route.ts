import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = join(process.cwd(), "uploads");

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // pdf-parse doesn't have type declarations, use require
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    return data.text;
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    // Verify session exists
    const session = await prisma.interviewSession.findUnique({
        where: { id: sessionId },
    });
    if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
        return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const savedFiles = [];

    for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !["txt", "pdf"].includes(ext)) {
            continue; // Skip unsupported files
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uniqueName = `${randomUUID()}.${ext}`;
        const filePath = join(UPLOAD_DIR, uniqueName);

        // Save file to disk
        await writeFile(filePath, buffer);

        // Extract text
        let transcribedText = "";
        if (ext === "txt") {
            transcribedText = buffer.toString("utf-8");
        } else if (ext === "pdf") {
            try {
                transcribedText = await extractTextFromPdf(buffer);
            } catch (err) {
                console.error(`Failed to extract text from PDF ${file.name}:`, err);
                transcribedText = "[PDF text extraction failed]";
            }
        }

        // Determine file type
        const fileType = ext === "pdf" ? "policy_doc" : "transcript_doc";
        const mimeType = ext === "pdf" ? "application/pdf" : "text/plain";

        // Save to database
        const sessionFile = await prisma.sessionFile.create({
            data: {
                sessionId,
                fileName: file.name,
                fileType: fileType as "transcript_doc" | "policy_doc",
                mimeType,
                fileSizeBytes: BigInt(buffer.length),
                storagePath: filePath,
                transcriptionStatus: "completed",
                transcribedText,
                uploadedById: user.id,
            },
        });

        savedFiles.push({
            id: sessionFile.id,
            fileName: sessionFile.fileName,
            fileType: sessionFile.fileType,
            fileSizeBytes: sessionFile.fileSizeBytes.toString(),
            transcriptionStatus: sessionFile.transcriptionStatus,
        });
    }

    return NextResponse.json({ files: savedFiles }, { status: 201 });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    const files = await prisma.sessionFile.findMany({
        where: { sessionId },
        select: {
            id: true,
            fileName: true,
            fileType: true,
            mimeType: true,
            fileSizeBytes: true,
            transcriptionStatus: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    // Convert BigInt to string for JSON serialization
    const serializedFiles = files.map((f) => ({
        ...f,
        fileSizeBytes: f.fileSizeBytes.toString(),
    }));

    return NextResponse.json({ files: serializedFiles });
}
