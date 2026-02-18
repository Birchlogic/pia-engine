/**
 * Deterministic converter: Schema-1 JSON → Mermaid DFD code.
 * Supports the enriched Schema-1 format with data_elements,
 * sub_processes, integrations, and reference_documents.
 */

interface DataElement {
    name: string;
    description?: string;
    classification?: string;
    purpose?: string;
    retention_period?: string;
    legal_basis?: string;
    storage_location?: string;
    owner?: string;
}

interface SubProcess {
    name: string;
    description?: string;
    routing?: string;
}

interface Integration {
    system: string;
    type?: string;
    direction?: string;
}

interface SchemaOneNode {
    id: string;
    type: "EXTERNAL_ENTITY" | "PROCESS" | "DATA_STORE";
    label: string;
    description?: string;
    data_elements?: DataElement[];
    sub_processes?: SubProcess[];
    sla?: string;
    integrations?: Integration[];
    reference_documents?: string[];
}

interface SchemaOneFlow {
    id: string;
    source: string;
    target: string;
    label: string;
    data_elements?: string[];
    bi_directional: boolean;
    transfer_mechanism?: string;
    cross_border?: boolean | null;
}

export interface SchemaOne {
    meta?: {
        project_name?: string;
        vertical_name?: string;
        generated_at?: string;
    };
    nodes: SchemaOneNode[];
    flows: SchemaOneFlow[];
}

/**
 * Sanitize a label for use in Mermaid syntax.
 */
function sanitizeLabel(label: string): string {
    return label
        .replace(/"/g, "'")
        .replace(/&/g, "and")
        .replace(/[<>]/g, "");
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function iconSvg(type: SchemaOneNode["type"]): string {
    // Inline SVG so it renders inside Mermaid's SVG/foreignObject without relying on external fonts/CSS.
    const common = "width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'";

    if (type === "DATA_STORE") {
        return `<svg ${common}><ellipse cx='12' cy='5' rx='9' ry='3'/><path d='M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5'/><path d='M3 12c0 1.7 4 3 9 3s9-1.3 9-3'/></svg>`;
    }
    if (type === "EXTERNAL_ENTITY") {
        return `<svg ${common}><path d='M18 20a6 6 0 0 0-12 0'/><circle cx='12' cy='10' r='4'/></svg>`;
    }
    // PROCESS
    return `<svg ${common}><path d='M12 15.5V20'/><path d='M7.5 12H4'/><path d='M20 12h-3.5'/><path d='M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z'/><path d='M12 4v3.5'/></svg>`;
}

export function generateMermaid(schema: SchemaOne): string {
    let mermaidCode = "graph TD\n";

    // 1. Define Styling Classes (DFD Standard)
    mermaidCode += "  classDef process fill:#f9f,stroke:#333,stroke-width:2px;\n";
    mermaidCode += "  classDef entity fill:#ff9,stroke:#333,stroke-width:2px;\n";
    mermaidCode += "  classDef store fill:#eee,stroke:#333,stroke-dasharray:5 5;\n";
    mermaidCode += "  classDef sensitive fill:#fcc,stroke:#c33,stroke-width:2px;\n";

    // 2. Group nodes by type using subgraphs for better layout
    const entities = schema.nodes.filter((n) => n.type === "EXTERNAL_ENTITY");
    const processes = schema.nodes.filter((n) => n.type === "PROCESS");
    const stores = schema.nodes.filter((n) => n.type === "DATA_STORE");

    const renderNode = (node: SchemaOneNode) => {
        const label = sanitizeLabel(node.label);
        const hasSensitive = node.data_elements?.some(
            (de) => de.classification === "PII/Sensitive" || de.classification === "Special Category"
        );
        const styleClass = hasSensitive ? "sensitive" : (
            node.type === "PROCESS" ? "process" :
                node.type === "EXTERNAL_ENTITY" ? "entity" : "store"
        );

        const iconHtml = `<span style='margin-right:8px;display:inline-flex;align-items:center;'>${iconSvg(node.type)}</span>`;
        const labelHtml = `<span>${escapeHtml(label)}</span>`;
        const html = `<span style='display:inline-flex;align-items:center;color:#111827;'>${iconHtml}${labelHtml}</span>`;

        switch (node.type) {
            case "PROCESS":
                mermaidCode += `  ${node.id}("${html}"):::${styleClass}\n`;
                break;
            case "EXTERNAL_ENTITY":
                mermaidCode += `  ${node.id}["${html}"]:::${styleClass}\n`;
                break;
            case "DATA_STORE":
                mermaidCode += `  ${node.id}[("${html}")]:::${styleClass}\n`;
                break;
        }
    };

    if (entities.length > 0) {
        mermaidCode += `  subgraph External Entities\n`;
        entities.forEach(renderNode);
        mermaidCode += `  end\n`;
    }

    if (processes.length > 0) {
        mermaidCode += `  subgraph Processes\n`;
        processes.forEach(renderNode);
        mermaidCode += `  end\n`;
    }

    if (stores.length > 0) {
        mermaidCode += `  subgraph Data Stores\n`;
        stores.forEach(renderNode);
        mermaidCode += `  end\n`;
    }

    // 3. Render Flows
    schema.flows.forEach((flow) => {
        const label = sanitizeLabel(flow.label);
        mermaidCode += `  ${flow.source} -->|"${label}"| ${flow.target}\n`;
    });

    return mermaidCode;
}
