import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { formatError } from "@/lib/utils";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://3.91.197.195:8000";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { projectId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/master-dfd/${projectId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const detail = errData.detail || errData.message;
            return NextResponse.json(
                { error: detail ? formatError(detail) : "Failed to fetch master DFD results." },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error communicating with Master DFD Results API:", err);
        return NextResponse.json(
            { error: "Internal server error communicating with Master DFD Results API" },
            { status: 500 }
        );
    }
}
