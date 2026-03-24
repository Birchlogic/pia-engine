import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse } from "@/lib/auth/responses";
import { logActivity } from "@/lib/activity";

// POST /api/activity — generic endpoint for frontend to log tracking events
export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const { action, entityType, entityId, details } = body;

        if (!action || !entityType || !entityId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await logActivity({
            userId: user.id,
            action,
            entityType,
            entityId,
            details,
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[Activity POST]", error);
        return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }
}
