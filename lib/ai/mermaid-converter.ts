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

        switch (node.type) {
            case "PROCESS":
                mermaidCode += `  ${node.id}("${label}"):::${styleClass}\n`;
                break;
            case "EXTERNAL_ENTITY":
                mermaidCode += `  ${node.id}["${label}"]:::${styleClass}\n`;
                break;
            case "DATA_STORE":
                mermaidCode += `  ${node.id}[("${label}")]:::${styleClass}\n`;
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
