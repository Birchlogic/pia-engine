import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
        return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const projects = await prisma.project.findMany({
        where: { orgId },
        include: {
            _count: { select: { verticals: true } },
            creator: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();

    if (!body.orgId || !body.name) {
        return NextResponse.json(
            { error: "orgId and name are required" },
            { status: 400 }
        );
    }

    const project = await prisma.project.create({
        data: {
            orgId: body.orgId,
            name: body.name,
            description: body.description || null,
            applicableRegulations: body.applicableRegulations || [],
            assessmentType: body.assessmentType || "full_pia",
            targetCompletionDate: body.targetCompletionDate
                ? new Date(body.targetCompletionDate)
                : null,
            createdById: user.id,
        },
    });

    return NextResponse.json(project, { status: 201 });
}
