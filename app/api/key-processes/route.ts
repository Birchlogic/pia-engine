import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import prisma from "@/lib/db/prisma";

/**
 * GET /api/key-processes?verticalId=xxx
 * Returns the full Schema-1 JSON (nodes + flows + meta)
 * from the stored DataMatrix for the Source of Truth tab.
 */
export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const verticalId = searchParams.get("verticalId");

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    // Fetch Schema-1 from DataMatrix
    const dataMatrix = await (prisma as any).dataMatrix.findUnique({
        where: { verticalId },
    });

    if (!dataMatrix?.schemaOneJson) {
        return NextResponse.json({ nodes: [], flows: [], meta: null });
    }

    const schema = dataMatrix.schemaOneJson as {
        meta?: { project_name?: string; vertical_name?: string; generated_at?: string };
        nodes: Array<{
            id: string;
            type: string;
            label: string;
            description?: string;
            data_elements?: Array<{
                name: string;
                description?: string;
                classification?: string;
                purpose?: string;
                retention_period?: string;
                legal_basis?: string;
                storage_location?: string;
                owner?: string;
            }>;
            sub_processes?: Array<{ name: string; description?: string; routing?: string }>;
            sla?: string;
            integrations?: Array<{ system: string; type?: string; direction?: string }>;
            reference_documents?: string[];
        }>;
        flows: Array<{
            id: string;
            source: string;
            target: string;
            label: string;
            data_elements?: string[];
            bi_directional?: boolean;
            transfer_mechanism?: string;
            cross_border?: boolean | null;
        }>;
    };

    return NextResponse.json({
        meta: schema.meta || null,
        nodes: schema.nodes || [],
        flows: schema.flows || [],
    });
}
