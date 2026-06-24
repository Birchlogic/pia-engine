import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://18.207.121.162:8000";

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/session/${verticalId}`, {
            method: "DELETE",
        });

        if (!res.ok) {
            console.warn(`Pipeline API delete returned ${res.status}`);
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (err) {
        console.error("Error deleting from Pipeline API:", err);
        // Return success so frontend isn't blocked if Docker is down
        return NextResponse.json({ success: true }, { status: 200 });
    }
}
