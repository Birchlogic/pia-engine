import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/auth/responses";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://54.84.243.190:8000";

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

        const res = await fetch(`${PIPELINE_API}/api/dfd/preview`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.PIPELINE_API_KEY || "default_token"}`,
            },
            body: JSON.stringify(body),
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
        console.error("Error in /api/dfd/preview:", err);
        return serverErrorResponse();
    }
}
