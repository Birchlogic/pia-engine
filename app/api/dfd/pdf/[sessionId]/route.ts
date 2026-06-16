import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

const PIPELINE_API = (process.env.DFD_API_BASE_URL || "http://13.219.89.59:8000").trim();

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/dfd/pdf/${sessionId}`, {
            method: "GET",
        });

        if (!res.ok) {
            const contentType = res.headers.get("content-type") || "";
            const errData = contentType.includes("application/json")
                ? await res.json().catch(() => ({}))
                : await res.text().catch(() => "");
            const msg =
                typeof errData === "string"
                    ? errData
                    : (errData as any)?.detail || (errData as any)?.message || `Backend HTTP ${res.status}`;

            return NextResponse.json({ error: msg }, { status: res.status });
        }

        const bytes = await res.arrayBuffer();

        return new NextResponse(bytes, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="dfd-${sessionId}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("Error communicating with Pipeline API (dfd pdf GET):", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Pipeline API" },
            { status: 500 }
        );
    }
}
