import { z } from "zod";

// ──────────────────────────────────────────────
// Step 1: Entity Extraction
// ──────────────────────────────────────────────

export const EntityTypeEnum = z.enum([
    "DATA_ELEMENT",
    "SYSTEM",
    "ACTOR",
    "PROCESSING_ACTIVITY",
    "THIRD_PARTY",
]);

export const ExtractedEntitySchema = z.object({
    entity_type: EntityTypeEnum,
    name: z.string().describe("Normalized entity name"),
    context_quote: z.string().describe("Exact or near-exact quote from the source text"),
    confidence: z.number().min(0).max(1).describe("Extraction confidence 0-1"),
});

export const EntityExtractionResultSchema = z.object({
    session_id: z.string(),
    entities: z.array(ExtractedEntitySchema),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;
export type EntityExtractionResult = z.infer<typeof EntityExtractionResultSchema>;

// ──────────────────────────────────────────────
// Step 2: Relationship Graph
// ──────────────────────────────────────────────

export const DataElementRelationshipSchema = z.object({
    data_element: z.string(),
    category: z.enum(["personal", "sensitive_personal", "non_personal", "anonymized", "pseudonymized"]),
    data_subjects: z.array(z.string()),
    collected_by: z.array(z.string()).describe("Actors/roles that collect this data"),
    collection_methods: z.array(z.string()),
    systems: z.array(z.string()).describe("Systems/apps that process this data"),
    storage_locations: z.array(z.string()),
    processing_activities: z.array(z.string()),
    access_roles: z.array(z.string()),
    shared_with_internal: z.array(z.string()),
    shared_with_external: z.array(z.string()),
    cross_border: z.boolean(),
    cross_border_details: z.string().nullable(),
    retention_info: z.string().nullable(),
    consent_info: z.string().nullable(),
    source_session_ids: z.array(z.string()),
    confidence: z.number().min(0).max(1),
});

export const RelationshipGraphResultSchema = z.object({
    vertical_name: z.string(),
    data_elements: z.array(DataElementRelationshipSchema),
});

export type DataElementRelationship = z.infer<typeof DataElementRelationshipSchema>;
export type RelationshipGraphResult = z.infer<typeof RelationshipGraphResultSchema>;

// ──────────────────────────────────────────────
// Step 3: Classification & Enrichment
// ──────────────────────────────────────────────

export const ClassifiedDataElementSchema = z.object({
    data_element_name: z.string(),
    data_category: z.enum(["personal", "sensitive_personal", "non_personal", "anonymized", "pseudonymized"]),
    data_sub_category: z.string().nullable(),
    data_subjects: z.array(z.string()),
    source_of_data: z.string(),
    collection_method: z.string(),
    purpose_of_processing: z.string(),
    legal_basis: z.string(),
    consent_mechanism: z.object({
        type: z.string(),
        collection_point: z.string(),
        withdrawal_method: z.string(),
    }).nullable(),
    processing_types: z.array(z.string()),
    systems_applications: z.array(z.string()),
    storage_location: z.string(),
    storage_format: z.string(),
    encryption_at_rest: z.enum(["yes", "no", "partial", "unknown"]),
    encryption_in_transit: z.enum(["yes", "no", "partial", "unknown"]),
    retention_period: z.string().nullable(),
    retention_compliant: z.boolean().nullable(),
    deletion_method: z.string().nullable(),
    access_roles: z.array(z.object({ role: z.string(), access_type: z.string() })),
    data_recipients_internal: z.array(z.string()),
    data_recipients_external: z.array(z.string()),
    third_party_details: z.array(z.object({
        party_name: z.string(),
        purpose: z.string(),
        agreement_type: z.string(),
    })).nullable(),
    cross_border_transfer: z.boolean(),
    cross_border_details: z.object({
        destination_country: z.string(),
        transfer_mechanism: z.string(),
    }).nullable(),
    data_owner: z.string(),
    confidence_score: z.number().min(0).max(1),
    gaps_flagged: z.array(z.string()),
});

export const ClassificationResultSchema = z.object({
    elements: z.array(ClassifiedDataElementSchema),
});

export type ClassifiedDataElement = z.infer<typeof ClassifiedDataElementSchema>;
export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// ──────────────────────────────────────────────
// Step 4: Risk Scoring (deterministic, no LLM)
// ──────────────────────────────────────────────

export const RiskFactorsSchema = z.object({
    sensitivity_weight: z.number().min(1).max(5),
    processing_risk: z.number().min(1).max(5),
    volume_indicator: z.number().min(1).max(5),
    exposure_factor: z.number().min(1).max(5),
    final_score: z.number().min(1).max(25),
});

export type RiskFactors = z.infer<typeof RiskFactorsSchema>;

// ──────────────────────────────────────────────
// Pipeline Progress Events
// ──────────────────────────────────────────────

export const PipelineStepEnum = z.enum([
    "extracting",
    "building_graph",
    "classifying",
    "scoring",
    "deduplicating",
    "persisting",
    "done",
    "error",
]);

export const ProgressEventSchema = z.object({
    step: PipelineStepEnum,
    message: z.string(),
    progress: z.number().min(0).max(100),
    detail: z.string().optional(),
});

export type ProgressEvent = z.infer<typeof ProgressEventSchema>;
