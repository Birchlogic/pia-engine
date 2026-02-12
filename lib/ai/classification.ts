import { llmCall } from "./llm-client";
import {
    ClassificationResultSchema,
    type ClassificationResult,
    type RelationshipGraphResult,
} from "./schemas";
import { classificationPrompt } from "./prompts";

/**
 * Step 3: Classify and enrich data elements with full DataMatrixRow columns.
 */
export async function classifyDataElements(
    relationshipGraph: RelationshipGraphResult,
    orgIndustry: string,
    regulatoryScope: string[]
): Promise<ClassificationResult> {
    if (relationshipGraph.data_elements.length === 0) {
        return { elements: [] };
    }

    const dataElementsJson = JSON.stringify(relationshipGraph.data_elements, null, 2);
    const prompt = classificationPrompt(
        dataElementsJson,
        relationshipGraph.vertical_name,
        orgIndustry,
        regulatoryScope
    );

    const result = await llmCall({
        prompt,
        schema: ClassificationResultSchema,
        temperature: 0.1,
    });

    return result;
}
