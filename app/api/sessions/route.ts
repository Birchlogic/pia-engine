import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();

    if (!body.verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    // Get next session number
    const maxSession = await prisma.interviewSession.aggregate({
        where: { verticalId: body.verticalId },
        _max: { sessionNumber: true },
    });

    const session = await prisma.interviewSession.create({
        data: {
            verticalId: body.verticalId,
            sessionDate: body.sessionDate ? new Date(body.sessionDate) : new Date(),
            sessionNumber: (maxSession._max.sessionNumber ?? 0) + 1,
            durationMinutes: body.durationMinutes || null,
            interviewerNames: body.interviewerNames || [],
            intervieweeNames: body.intervieweeNames || [],
            intervieweeRoles: body.intervieweeRoles || [],
            assessmentCriteriaTags: body.assessmentCriteriaTags || [],
            rawTextNotes: body.rawTextNotes || null,
            status: "draft",
            createdById: user.id,
        },
    });

    return NextResponse.json(session, { status: 201 });
}
