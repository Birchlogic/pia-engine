import { getCurrentUser } from "@/lib/auth/helpers";
import { getJob, subscribeToJob } from "@/lib/jobs/job-runner";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
        return new Response("jobId parameter required", { status: 400 });
    }

    const job = getJob(jobId);
    if (!job) {
        return new Response("Job not found", { status: 404 });
    }

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            const send = (data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // Stream closed
                }
            };

            // Subscribe to progress updates
            const unsubscribe = subscribeToJob(jobId, (event) => {
                send(event);
                if (event.step === "done" || event.step === "error") {
                    try {
                        controller.close();
                    } catch {
                        // Already closed
                    }
                }
            });

            // If job is already done, close stream
            if (job.status === "done" || job.status === "error") {
                setTimeout(() => {
                    try {
                        controller.close();
                    } catch {
                        // Already closed
                    }
                }, 100);
            }

            // Cleanup when the client disconnects
            request.signal.addEventListener("abort", () => {
                unsubscribe();
            });
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
