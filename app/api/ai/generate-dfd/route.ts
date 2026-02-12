import { NextResponse } from "next/server";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";
import { startJob, getJob } from "@/lib/jobs/job-runner";
import { generateDFD } from "@/lib/ai/dfd-generator";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const { verticalId } = body;

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    const jobId = `dfd-${verticalId}`;

    // Check if already running
    const existing = getJob(jobId);
    if (existing && existing.status === "running") {
        return NextResponse.json({ jobId, status: "already_running" });
    }

    // Start the job
    startJob(jobId, async (onProgress) => {
        return generateDFD({ verticalId, onProgress });
    });

    return NextResponse.json({ jobId, status: "started" }, { status: 202 });
}
