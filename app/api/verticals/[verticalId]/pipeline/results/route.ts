import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://100.25.119.13:8000";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { verticalId } = await params;

    try {
        const res = await fetch(`${PIPELINE_API}/api/results/${verticalId}`, {
            headers: {
                "Authorization": `Bearer ${process.env.PIPELINE_API_KEY || 'default_token'}`
            }
        });

        if (!res.ok) {
            if (res.status === 404) {
                return NextResponse.json(
                    { error: "Results not ready or session not found" },
                    { status: 404 }
                );
            }
            // safely handle 401 or non-json errors
            let errData = {};
            try {
                errData = await res.json();
            } catch {
                errData = { detail: `HTTP Error: ${res.status}` };
            }
            return NextResponse.json(
                { error: (errData as any).detail || "Failed to fetch pipeline results." },
                { status: res.status }
            );
        }

        // Return the raw Docker response — no Prisma writes for the rest of pipeline
        const data = await res.json();

        // Overlay any user-defined DFD manual modifications
        const vertical = await prisma.vertical.findUnique({
            where: { id: verticalId },
            select: { dfdOverride: true }
        });

        if (vertical?.dfdOverride) {
            data.dfd_json = vertical.dfdOverride;
        }

        return NextResponse.json(data, { status: 200 });
    } catch (err) {
        console.error("Error fetching pipeline results:", err);
        return NextResponse.json(
            { error: "Internal server error fetching pipeline results" },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ verticalId: string }> }
) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const { verticalId } = await params;
        const body = await request.json();

        // Ensure vertical belongs to user's org
        const vertical = await prisma.vertical.findUnique({
            where: { id: verticalId },
            include: { project: true }
        });

        if (!vertical) return NextResponse.json({ error: "Vertical not found" }, { status: 404 });
        if (vertical.project.orgId !== user.orgId) return forbiddenResponse("Access denied");

        const updated = await prisma.vertical.update({
            where: { id: verticalId },
            data: { dfdOverride: body.dfd_json }
        });

        return NextResponse.json({ success: true, dfd_json: updated.dfdOverride });
    } catch (err) {
        console.error("Error updating DFD JSON:", err);
        return serverErrorResponse();
    }
}
