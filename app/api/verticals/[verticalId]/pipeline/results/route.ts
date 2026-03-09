import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://54.146.79.189:8000";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/results/${verticalId}`);

        if (!res.ok) {
            if (res.status === 404) {
                return NextResponse.json(
                    { error: "Results not ready or session not found" },
                    { status: 404 }
                );
            }
            const errData = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.detail || "Failed to fetch pipeline results." },
                { status: res.status }
            );
        }

        // Return the raw Docker response — no Prisma writes
        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error fetching pipeline results:", err);
        return NextResponse.json(
            { error: "Internal server error fetching pipeline results" },
            { status: 500 }
        );
    }
}
