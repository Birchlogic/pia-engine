import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const verticals = await prisma.vertical.findMany({
        where: { projectId },
        include: {
            _count: { select: { sessions: true } },
        },
        orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(verticals);
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();

    if (!body.projectId || !body.name) {
        return NextResponse.json(
            { error: "projectId and name are required" },
            { status: 400 }
        );
    }

    // Get current max sort order
    const maxSort = await prisma.vertical.aggregate({
        where: { projectId: body.projectId },
        _max: { sortOrder: true },
    });

    const vertical = await prisma.vertical.create({
        data: {
            projectId: body.projectId,
            name: body.name,
            description: body.description || null,
            headName: body.headName || null,
            headRole: body.headRole || null,
            headContact: body.headContact || null,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
            createdById: user.id,
        },
    });

    return NextResponse.json(vertical, { status: 201 });
}
