import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { orgId } = await params;

    const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
            projects: {
                include: {
                    _count: { select: { verticals: true } },
                    creator: { select: { name: true } },
                },
                orderBy: { createdAt: "desc" },
            },
            creator: { select: { name: true } },
        },
    });

    if (!org) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(org);
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { orgId } = await params;
    const body = await request.json();

    const org = await prisma.organization.update({
        where: { id: orgId },
        data: {
            name: body.name,
            industry: body.industry,
            jurisdiction: body.jurisdiction,
            regulatoryScope: body.regulatoryScope,
            sizeBand: body.sizeBand,
        },
    });

    return NextResponse.json(org);
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { orgId } = await params;

    await prisma.organization.delete({ where: { id: orgId } });

    return NextResponse.json({ success: true });
}
