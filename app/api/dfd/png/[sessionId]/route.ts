import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";

const DFD_API_BASE_URL = process.env.DFD_API_BASE_URL || "http://52.91.71.144:8000";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { sessionId } = await params;
        if (!sessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        console.log(`[PNG API] Proxying PNG export for session: ${sessionId}`);

        const controller = new AbortController();
        const timeoutMs = 60_000; // 60 seconds timeout
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`${DFD_API_BASE_URL}/api/dfd/png/${sessionId}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Cookie": request.headers.get("cookie") || "",
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => "Unknown error");
                console.error(`[PNG API] Backend error: ${response.status} - ${errorText}`);
                return NextResponse.json(
                    { error: `Failed to generate PNG: ${response.status}` },
                    { status: response.status }
                );
            }

            // Get the PNG data as blob
            const pngBlob = await response.blob();
            
            // Return the PNG with appropriate headers for download
            return new NextResponse(pngBlob, {
                status: 200,
                headers: {
                    "Content-Type": "image/png",
                    "Content-Disposition": `attachment; filename="dfd-${sessionId}.png"`,
                    "Cache-Control": "no-cache",
                },
            });

        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
                return NextResponse.json(
                    { error: "PNG generation timed out" },
                    { status: 408 }
                );
            }
            throw fetchError;
        }

    } catch (error) {
        console.error("[PNG API] Unexpected error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
