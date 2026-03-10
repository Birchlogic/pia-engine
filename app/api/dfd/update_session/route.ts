import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const { session_id, dfd_json, knowledge_graph, dfd_plan_json } = body;

        if (!session_id) {
            return NextResponse.json({ error: "session_id is required" }, { status: 400 });
        }

        // The session_id provided by the user might actually be the verticalId in some contexts,
        // or it might be a real InterviewSession ID. 
        // We'll try to find if it's a Vertical first, then an InterviewSession.

        let vertical = await (prisma.vertical as any).findUnique({
            where: { id: session_id },
            include: { project: true }
        });

        if (!vertical) {
            // Try as InterviewSession
            const session = await (prisma.interviewSession as any).findUnique({
                where: { id: session_id },
                include: { vertical: { include: { project: true } } }
            });
            if (session) {
                vertical = session.vertical;
            }
        }

        if (!vertical) {
            return NextResponse.json({ error: "Session or Vertical not found" }, { status: 404 });
        }

        // Check permissions
        if (vertical.project.orgId !== user.orgId) {
            return forbiddenResponse("Access denied");
        }

        // Save the updates. In this architecture, we use dfdOverride to store manual edits.
        // We'll store the combined structure in dfdOverride or update specific fields if they existed.
        // Since we only have dfdOverride, we'll store the object there.

        const updated = await (prisma.vertical as any).update({
            where: { id: vertical.id },
            data: {
                dfdOverride: {
                    dfd_json,
                    knowledge_graph,
                    dfd_render_plan: dfd_plan_json
                }
            } as any
        });

        return NextResponse.json({
            success: true,
            message: "DFD updated successfully",
            data: updated.dfdOverride
        });

    } catch (err) {
        console.error("Error in /api/dfd/update_session:", err);
        return serverErrorResponse();
    }
}
