import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://54.227.129.31:8000";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/status/${verticalId}`);

        if (!res.ok) {
            if (res.status === 404) {
                return NextResponse.json({ status: "not_started" }, { status: 200 });
            }
            const errData = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: errData.detail || "Failed to fetch pipeline status." },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error fetching pipeline status:", err);
        return NextResponse.json(
            { error: "Internal server error fetching pipeline status" },
            { status: 500 }
        );
    }
}
