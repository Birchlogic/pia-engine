import { llmCall } from "./llm-client";
import { RelationshipGraphResultSchema, type EntityExtractionResult, type RelationshipGraphResult } from "./schemas";
import { relationshipGraphPrompt } from "./prompts";

/**
 * Step 2: Build a relationship graph from extracted entities across all sessions.
 * Merges entities, resolves duplicates, and maps data flows.
 */
export async function buildRelationshipGraph(
    extractionResults: EntityExtractionResult[],
    verticalName: string
): Promise<RelationshipGraphResult> {
    // Flatten all entities with their session IDs
    const allEntities = extractionResults.flatMap((r) =>
        r.entities.map((e) => ({
            ...e,
            session_id: r.session_id,
        }))
    );

    if (allEntities.length === 0) {
        return { vertical_name: verticalName, data_elements: [] };
    }

    const entitiesJson = JSON.stringify(allEntities, null, 2);
    const prompt = relationshipGraphPrompt(entitiesJson, verticalName);

    const result = await llmCall({
        prompt,
        schema: RelationshipGraphResultSchema,
        temperature: 0.1,
    });

    return result;
}
