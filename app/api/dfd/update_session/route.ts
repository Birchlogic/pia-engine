import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/helpers";
import { unauthorizedResponse, forbiddenResponse, serverErrorResponse } from "@/lib/auth/responses";
import { SignJWT } from "jose";

const PIPELINE_API = process.env.DFD_API_BASE_URL || "http://34.232.76.135:8000";

function getPayloadSecret(): Uint8Array {
    const secret = process.env.PAYLOAD_TOKEN;
    if (!secret) throw new Error("PAYLOAD_TOKEN is not set in environment variables");
    return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const { session_id, nodes, edges, levels, pipeline_docs, dfd_json, knowledge_graph, dfd_plan_json } = body;

        if (!session_id) {
            return NextResponse.json({ error: "session_id is required" }, { status: 400 });
        }

        // Find the vertical (session_id may be verticalId or InterviewSession ID)
        let vertical = await (prisma.vertical as any).findUnique({
            where: { id: session_id },
            include: { project: true }
        });

        if (!vertical) {
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

        if (vertical.project.orgId !== user.orgId) {
            return forbiddenResponse("Access denied");
        }

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

        // Build the override object for Prisma storage
        const overrideData: any = {};
        if (nodes && edges) {
            // New format: store the preview-format data as knowledge_graph equivalent
            overrideData.knowledge_graph = {
                nodes: nodes.map((n: any) => ({
                    node_id: n.id,
                    name: n.name,
                    type: n.type,
                    aliases: n.aliases || [],
                    data_elements: n.data_elements || [],
                    risks: n.risks || [],
                    sources: n.sources || [],
                })),
                edges: edges.map((e: any) => ({
                    source_node: e.source,
                    target_node: e.target,
                    data_elements: e.data_elements || [],
                    flow_type: e.flow_type || "",
                    channel: e.channel || "",
                    inferred: e.inferred || false,
                    sources: e.sources || [],
                })),
            };
            if (levels) {
                overrideData.dfd_render_plan = { levels };
            }
        } else {
            // Legacy format
            if (dfd_json) overrideData.dfd_json = dfd_json;
            if (knowledge_graph) overrideData.knowledge_graph = knowledge_graph;
            if (dfd_plan_json) overrideData.dfd_render_plan = dfd_plan_json;
        }

        await (prisma.vertical as any).update({
            where: { id: vertical.id },
            data: { dfdOverride: overrideData } as any
        });

        // Forward to Python backend for engine-side rendering + persistence
        let backendHtml: string | null = null;
        try {
            const backendBody = (nodes && edges)
                ? { session_id, nodes, edges, levels: levels || [], pipeline_docs: pipeline_docs || {} }
                : { session_id, dfd_json, knowledge_graph, dfd_plan_json };

            const fullPayload = {
                ai_config: { type: activeProvider.type, model: activeProvider.model, apiKey: activeProvider.apiKey },
                data: backendBody
            };

            const token = await new SignJWT(fullPayload as any)
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .setExpirationTime("15m")
                .sign(getPayloadSecret());

            const backendRes = await fetch(`${PIPELINE_API}/api/dfd/update_session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });

            if (backendRes.ok) {
                const backendData = await backendRes.json();
                backendHtml = backendData.html || null;
            } else {
                console.error("Pipeline responded with error", backendRes.status);
            }
        } catch (error) {
            console.error("Failed to forward DFD update to backend engine:", error);
        }

        return NextResponse.json({
            success: true,
            message: "DFD updated successfully",
            html: backendHtml,
        });

    } catch (err) {
        if (err instanceof Error && err.message.includes("PAYLOAD_TOKEN")) {
            return serverErrorResponse();
        }
        console.error("Error in /api/dfd/update_session:", err);
        return serverErrorResponse();
    }
}

