import type { ProgressEvent } from "./schemas";

interface GenerateMatrixOptions {
    verticalId: string;
    onProgress?: (event: ProgressEvent) => void;
}

/**
 * Full matrix generation orchestrator.
 * Steps: extract → graph → classify → score → dedup → persist
 */
export async function generateDataMatrix(options: GenerateMatrixOptions) {
    const { verticalId, onProgress } = options;

    const emit = (step: ProgressEvent["step"], message: string, progress: number, detail?: string) => {
        onProgress?.({ step, message, progress, detail });
    };

    emit("error", "Matrix generation orchestrator is not supported in this build. Use /api/ai/generate-matrix instead.", 100);
    throw new Error("Matrix generation orchestrator is not supported in this build. Use /api/ai/generate-matrix instead.");
}
