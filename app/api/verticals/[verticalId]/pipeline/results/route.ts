import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://3.228.3.140:8000";

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
        const vertical = await (prisma.vertical as any).findUnique({
            where: { id: verticalId },
            select: { id: true, name: true, headName: true, headRole: true, projectId: true, description: true, assessmentStatus: true, createdAt: true, updatedAt: true, createdById: true, headContact: true, sortOrder: true, dfdOverride: true }
        });

        if (vertical?.dfdOverride) {
            const override = vertical.dfdOverride as any;
            if (override.dfd_json || override.knowledge_graph || override.dfd_render_plan) {
                if (override.dfd_json) data.dfd_json = override.dfd_json;
                if (override.knowledge_graph) data.knowledge_graph = override.knowledge_graph;
                if (override.dfd_render_plan) data.dfd_render_plan = override.dfd_render_plan;
            } else {
                // Fallback for old simple format
                data.dfd_json = vertical.dfdOverride;
            }
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

        const updated = await (prisma.vertical as any).update({
            where: { id: verticalId },
            data: { dfdOverride: body.dfd_json } as any
        });

        return NextResponse.json({ success: true, dfd_json: updated.dfdOverride });
    } catch (err) {
        console.error("Error updating DFD JSON:", err);
        return serverErrorResponse();
    }
}
