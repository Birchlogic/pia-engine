// ──────────────────────────────────────────────
// All prompt templates for the AI pipeline
// ──────────────────────────────────────────────

export function entityExtractionPrompt(sessionContent: string, verticalName: string): string {
    return `You are a privacy assessment analyst. Extract all privacy-relevant entities from this interview session transcript conducted for the "${verticalName}" vertical.

For each entity found, categorize it as one of:
- DATA_ELEMENT: A specific type of personal or organizational data (e.g., "employee name", "customer email", "health records", "IP address")
- SYSTEM: A software system, application, or platform (e.g., "Salesforce", "HRMS", "AWS S3 bucket")
- ACTOR: A person, role, or team that interacts with data (e.g., "HR Manager", "external auditor", "marketing team")
- PROCESSING_ACTIVITY: An action performed on data (e.g., "collects", "stores", "shares with", "deletes after 2 years")
- THIRD_PARTY: An external organization (e.g., "payroll provider ADP", "cloud vendor AWS", "insurance company")

Rules:
- Be thorough — extract EVERY privacy-relevant entity mentioned.
- Normalize names (e.g., "employee email address" and "staff email" should both be "employee email").
- Include a direct or near-direct quote from the source text as context.
- Set confidence to 1.0 for explicitly mentioned entities, 0.7-0.9 for implied ones, and below 0.5 for uncertain ones.
- Do NOT invent entities that are not in the text.

Session content:
---
${sessionContent}
---

Return a JSON object with the schema: { session_id: string, entities: [{ entity_type, name, context_quote, confidence }] }`;
}

export function relationshipGraphPrompt(
    entitiesJson: string,
    verticalName: string
): string {
    return `You are a privacy assessment analyst. Given the following extracted entities from multiple interview sessions for the "${verticalName}" vertical, construct a relationship graph.

For each unique DATA_ELEMENT, return an object with ALL of these fields:
- data_element: the normalized name of the data element (string)
- category: personal | sensitive_personal | non_personal | anonymized | pseudonymized
- data_subjects: who the data is about (e.g., ["employees", "customers"])
- collected_by: actors/roles that collect this data
- collection_methods: how it is collected
- systems: systems/apps that process this data
- storage_locations: where it is stored
- processing_activities: what is done with it
- access_roles: who can access it
- shared_with_internal: internal departments/teams it goes to
- shared_with_external: external parties it goes to
- cross_border: boolean, whether it crosses national borders
- cross_border_details: destination country and mechanism if applicable
- retention_info: how long it is kept
- consent_info: how consent is obtained
- source_session_ids: which session IDs mentioned this element
- confidence: overall confidence in the relationship mapping (0-1)

Rules:
- Merge entities that refer to the same thing (e.g., "employee email" and "staff email address").
- Take the UNION of information from all sessions — if Session 1 says "stored in HRMS" and Session 2 adds "also in Oracle DB", include both.
- Set confidence lower for relationships that are implied rather than explicit.
- Do NOT invent relationships not supported by the entities.

Extracted entities:
---
${entitiesJson}
---

Return a JSON object with this exact schema:
{
  "vertical_name": "string",
  "data_elements": [
    {
      "data_element": "normalized name of the data element",
      "category": "personal | sensitive_personal | non_personal | anonymized | pseudonymized",
      "data_subjects": ["..."],
      "collected_by": ["..."],
      "collection_methods": ["..."],
      "systems": ["..."],
      "storage_locations": ["..."],
      "processing_activities": ["..."],
      "access_roles": ["..."],
      "shared_with_internal": ["..."],
      "shared_with_external": ["..."],
      "cross_border": false,
      "cross_border_details": "string or null",
      "retention_info": "string or null",
      "consent_info": "string or null",
      "source_session_ids": ["..."],
      "confidence": 0.9
    }
  ]
}`;
}

export function classificationPrompt(
    dataElements: string,
    verticalName: string,
    orgIndustry: string,
    regulatoryScope: string[]
): string {
    return `You are a privacy compliance expert. Classify the following data elements according to privacy regulations.

Vertical: ${verticalName}
Organization Industry: ${orgIndustry}
Applicable Regulations: ${regulatoryScope.join(", ")}

For each data element, populate ALL of the following fields. For any field where the source material is insufficient, set confidence_score below 0.5 and add a specific gap description to gaps_flagged.

Required fields per element:
- data_element_name, data_category, data_sub_category
- data_subjects, source_of_data, collection_method
- purpose_of_processing, legal_basis
- consent_mechanism (null if not applicable)
- processing_types, systems_applications
- storage_location, storage_format
- encryption_at_rest (yes/no/partial/unknown), encryption_in_transit (yes/no/partial/unknown)
- retention_period, retention_compliant, deletion_method
- access_roles (array of {role, access_type})
- data_recipients_internal, data_recipients_external
- third_party_details (array of {party_name, purpose, agreement_type} or null)
- cross_border_transfer, cross_border_details (null if not applicable)
- data_owner
- confidence_score (0-1, overall confidence)
- gaps_flagged (array of specific gaps like "Retention period not discussed", "Encryption status unknown")

Rules:
- NEVER fabricate data. If something was not discussed, flag it as a gap.
- Use the regulatory framework to infer legal basis where reasonable (e.g., DPDPA for India).
- Set confidence below 0.5 for any field that is inferred rather than explicitly stated.

Data elements with context:
---
${dataElements}
---

Return a JSON object with the schema: { elements: [...] }`;
}

export function mermaidDFDPrompt(
    matrixDataJson: string,
    verticalName: string,
    orgName: string
): string {
    return `You are a privacy data flow diagram expert. Generate a Mermaid flowchart diagram that visualizes the data flows described in the Data Matrix for the "${verticalName}" vertical of "${orgName}".

The diagram must follow standard DFD conventions:
- **External Entities**: People, roles, or external organizations that send/receive data (rectangles)
- **Processes / Systems**: Internal systems, applications, or teams that process data (rounded rectangles or cylinders)
- **Data Stores**: Databases, file systems, or storage locations (double-lined rectangles using [[...]])
- **Channels**: Communication channels like email, phone, APIs (plain rectangles)

Use Mermaid "flowchart LR" (left-to-right) syntax. Follow these rules:

1. Use classDef for styling:
   - ext: External entities (fill:#fff, stroke:#111)
   - proc: Processes/systems (fill:#f6f6f6, stroke:#111)
   - store: Data stores (fill:#ffffff, stroke:#111, stroke-dasharray: 4 3)
   - chan: Channels (fill:#ffffff, stroke:#111)
   - risk_high: High risk nodes (fill:#fef2f2, stroke:#ef4444, stroke-width:2px)
   - risk_critical: Critical risk nodes (fill:#fef2f2, stroke:#dc2626, stroke-width:3px)

2. Node ID rules:
   - Use short PascalCase IDs (e.g., Customer, SalesforceCRM, HRDatabase)
   - No spaces or special characters in IDs
   - Use descriptive labels in quotes for display

3. Edge labels should describe what data flows (e.g., |"Employee PII"|, |"Loan account data"|)

4. Add comments (%%) to group sections: External entities, Channels, Processes/systems, Data stores, Flows

5. For data stores that contain PII or sensitive data, add "<br/>PII Sensitive" or "<br/>PII Restricted" in the label

6. Mark cross-border data flows with a comment or dashed styling

7. Be comprehensive — include ALL data elements, systems, external parties, and storage locations from the matrix data

8. Keep the diagram readable — group related flows, avoid crossing edges where possible

Data Matrix rows (JSON):
---
${matrixDataJson}
---

Return a JSON object with this exact schema:
{
  "mermaid_code": "<the complete Mermaid flowchart code as a single string>",
  "summary": "<brief description of the data flow diagram>",
  "node_count": <number of nodes>,
  "edge_count": <number of edges>,
  "high_risk_flows": [<list of high/critical risk flow descriptions>],
  "cross_border_flows": [<list of cross-border flow descriptions>],
  "unencrypted_flows": [<list of unencrypted data flow descriptions>]
}`;
}
