import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/auth/responses";
import { SignJWT } from "jose";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://54.221.187.254:8000";

function getPayloadSecret(): Uint8Array {
    const secret = process.env.PAYLOAD_TOKEN;
    if (!secret) throw new Error("PAYLOAD_TOKEN is not set in environment variables");
    return new TextEncoder().encode(secret);
}

/**
 * POST /api/dfd/preview
 * Proxies to the backend DFD preview endpoint.
 * Accepts { nodes, edges, levels, pipeline_docs }
 * Returns { html: "<full HTML string>" }
 */
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();

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

        const fullPayload = {
            ai_config: { type: activeProvider.type, model: activeProvider.model, apiKey: activeProvider.apiKey },
            data: body
        };

        const token = await new SignJWT(fullPayload as any)
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("15m")
            .sign(getPayloadSecret());

        const res = await fetch(`${PIPELINE_API}/api/dfd/preview`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
        });

        if (!res.ok) {
            let errData: any = {};
            try {
                errData = await res.json();
            } catch {
                errData = { detail: `Backend HTTP ${res.status}` };
            }
            return NextResponse.json(
                { error: errData.detail || "Failed to generate DFD preview" },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        if (err instanceof Error && err.message.includes("PAYLOAD_TOKEN")) {
            return serverErrorResponse();
        }
        console.error("Error in /api/dfd/preview:", err);
        return serverErrorResponse();
    }
}
