import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

const PIPELINE_API = (process.env.DFD_API_BASE_URL || "http://52.91.71.144:8000").trim();

async function proxy(method: "GET" | "POST", sessionId: string) {
    const res = await fetch(`${PIPELINE_API}/api/dfd/regenerate/${sessionId}`, {
        method,
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const detail = (errData as any).detail || (errData as any).message;
        return NextResponse.json(
            { error: detail || `Backend HTTP ${res.status}` },
            { status: res.status }
        );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    try {
        return await proxy("GET", sessionId);
    } catch (err) {
        console.error("Error communicating with Pipeline API (dfd regenerate GET):", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Pipeline API" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { sessionId } = await params;

    try {
        return await proxy("POST", sessionId);
    } catch (err) {
        console.error("Error communicating with Pipeline API (dfd regenerate POST):", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Pipeline API" },
            { status: 500 }
        );
    }
}
