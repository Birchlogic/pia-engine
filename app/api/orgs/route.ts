import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const orgs = await prisma.organization.findMany({
        include: {
            _count: { select: { projects: true } },
            creator: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(orgs);
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json();

    const org = await prisma.organization.create({
        data: {
            name: body.name,
            industry: body.industry || null,
            jurisdiction: body.jurisdiction || null,
            regulatoryScope: body.regulatoryScope || [],
            sizeBand: body.sizeBand || null,
            createdById: user.id,
        },
    });

    return NextResponse.json(org, { status: 201 });
}
