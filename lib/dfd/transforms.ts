/**
 * Transform utilities for converting between the Results API format
 * and the Preview/Update API format for DFD data.
 *
 * Results API uses: node_id, source_node, target_node
 * Preview/Update API uses: id, source, target
 */

export interface ResultNode {
    node_id: string;
    name: string;
    type: string;
    aliases?: string[];
    data_elements?: string[];
    risks?: string[];
    sources?: string[];
}

export interface ResultEdge {
    source_node: string;
    target_node: string;
    data_elements?: string[];
    flow_type?: string;
    channel?: string;
    inferred?: boolean;
    sources?: string[];
}

export interface PreviewNode {
    id: string;
    name: string;
    type: string;
    aliases: string[];
    data_elements: string[];
    risks: string[];
    sources: string[];
}

export interface PreviewEdge {
    source: string;
    target: string;
    data_elements: string[];
    flow_type: string;
    channel: string;
    inferred: boolean;
    sources: string[];
}

export interface PreviewPayload {
    nodes: PreviewNode[];
    edges: PreviewEdge[];
    levels: string[][];
    pipeline_docs: Record<string, any>;
}

/**
 * Transform the results API knowledge_graph + render_plan into the
 * shape required by POST /api/dfd/preview and POST /api/dfd/update_session.
 */
export function transformForPreview(
    knowledgeGraph: { nodes?: ResultNode[]; edges?: ResultEdge[] },
    renderPlan?: { levels?: string[][] }
): PreviewPayload {
    return {
        nodes: (knowledgeGraph?.nodes || []).map((n) => ({
            id: n.node_id ?? (n as any).id ?? "",
            name: n.name || "",
            type: n.type || "unknown",
            aliases: n.aliases || [],
            data_elements: n.data_elements || [],
            risks: n.risks || [],
            sources: n.sources || [],
        })),
        edges: (knowledgeGraph?.edges || []).map((e) => ({
            source: e.source_node ?? (e as any).source ?? "",
            target: e.target_node ?? (e as any).target ?? "",
            data_elements: e.data_elements || [],
            flow_type: e.flow_type || "",
            channel: e.channel || "",
            inferred: e.inferred ?? false,
            sources: e.sources || [],
        })),
        levels: renderPlan?.levels || [],
        pipeline_docs: {},
    };
}

/**
 * Transform preview/update format back to the results API format
 * (for local state reconciliation after edits).
 */
export function transformFromPreview(payload: PreviewPayload) {
    return {
        nodes: payload.nodes.map((n) => ({
            node_id: n.id,
            name: n.name,
            type: n.type,
            aliases: n.aliases,
            data_elements: n.data_elements,
            risks: n.risks,
            sources: n.sources,
        })),
        edges: payload.edges.map((e) => ({
            source_node: e.source,
            target_node: e.target,
            data_elements: e.data_elements,
            flow_type: e.flow_type,
            channel: e.channel,
            inferred: e.inferred,
            sources: e.sources,
        })),
        levels: payload.levels,
    };
}
