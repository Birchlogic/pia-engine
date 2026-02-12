import { llmCall } from "./llm-client";
import { EntityExtractionResultSchema, type EntityExtractionResult } from "./schemas";
import { entityExtractionPrompt } from "./prompts";

interface SessionInput {
    id: string;
    rawTextNotes: string | null;
    aiSummary: string | null;
    intervieweeNames: string[];
    intervieweeRoles: string[];
}

/**
 * Step 1: Extract privacy entities from a single session.
 * This is parallelizable across sessions.
 */
export async function extractEntities(
    session: SessionInput,
    verticalName: string
): Promise<EntityExtractionResult> {
    const content = [
        session.rawTextNotes,
        session.aiSummary ? `\n\nAI Summary:\n${session.aiSummary}` : "",
    ]
        .filter(Boolean)
        .join("\n");

    if (!content.trim()) {
        return { session_id: session.id, entities: [] };
    }

    const prompt = entityExtractionPrompt(content, verticalName);

    const result = await llmCall({
        prompt,
        schema: EntityExtractionResultSchema,
        temperature: 0.1,
    });

    // Override session_id to ensure correctness
    return { ...result, session_id: session.id };
}

/**
 * Extract entities from multiple sessions in parallel.
 * Returns results in order, with concurrency limit.
 */
export async function extractEntitiesBatch(
    sessions: SessionInput[],
    verticalName: string,
    onProgress?: (completed: number, total: number) => void
): Promise<EntityExtractionResult[]> {
    const CONCURRENCY = 3;
    const results: EntityExtractionResult[] = [];
    let completed = 0;

    for (let i = 0; i < sessions.length; i += CONCURRENCY) {
        const batch = sessions.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map((s) => extractEntities(s, verticalName))
        );
        results.push(...batchResults);
        completed += batch.length;
        onProgress?.(completed, sessions.length);
    }

    return results;
}
