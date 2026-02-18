import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getCurrentUser, unauthorizedResponse } from "@/lib/auth/helpers";

export async function GET(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const verticalId = searchParams.get("verticalId");

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }

    const dfd = await prisma.dfdGraph.findUnique({
        where: { verticalId },
    });

    return NextResponse.json({ mermaidCode: dfd?.mermaidCode || null });
}

export async function PUT(request: Request) {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const body = await request.json().catch(() => null);
    const verticalId = body?.verticalId as string | undefined;
    const mermaidCode = body?.mermaidCode as string | undefined;

    if (!verticalId) {
        return NextResponse.json({ error: "verticalId is required" }, { status: 400 });
    }
    if (!mermaidCode || typeof mermaidCode !== "string") {
        return NextResponse.json({ error: "mermaidCode is required" }, { status: 400 });
    }

    await prisma.dfdGraph.upsert({
        where: { verticalId },
        create: { verticalId, mermaidCode },
        update: { mermaidCode },
    });

    return NextResponse.json({ success: true });
}
