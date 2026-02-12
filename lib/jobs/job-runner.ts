import type { ProgressEvent } from "@/lib/ai/schemas";

interface Job {
    id: string;
    status: "running" | "done" | "error";
    progress: ProgressEvent[];
    result?: unknown;
    error?: string;
    listeners: Set<(event: ProgressEvent) => void>;
}

// In-memory job store (fine for POC, single instance)
const jobs = new Map<string, Job>();

export function getJob(jobId: string): Job | undefined {
    return jobs.get(jobId);
}

export function startJob(
    jobId: string,
    fn: (onProgress: (event: ProgressEvent) => void) => Promise<unknown>
): Job {
    // If job already exists and is running, return it
    const existing = jobs.get(jobId);
    if (existing && existing.status === "running") return existing;

    const job: Job = {
        id: jobId,
        status: "running",
        progress: [],
        listeners: new Set(),
    };
    jobs.set(jobId, job);

    const onProgress = (event: ProgressEvent) => {
        job.progress.push(event);
        // Notify all SSE listeners
        for (const listener of job.listeners) {
            listener(event);
        }
    };

    // Run the job async
    fn(onProgress)
        .then((result) => {
            job.status = "done";
            job.result = result;
        })
        .catch((err) => {
            job.status = "error";
            job.error = err instanceof Error ? err.message : String(err);
            onProgress({
                step: "error",
                message: job.error ?? "Unknown error",
                progress: -1,
            });
        });

    return job;
}

export function subscribeToJob(jobId: string, listener: (event: ProgressEvent) => void): () => void {
    const job = jobs.get(jobId);
    if (!job) return () => { };

    job.listeners.add(listener);

    // Send all existing progress events to the new listener
    for (const event of job.progress) {
        listener(event);
    }

    // Return cleanup function
    return () => {
        job.listeners.delete(listener);
    };
}
