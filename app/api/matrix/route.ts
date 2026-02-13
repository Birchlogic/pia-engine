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

    const rows = await prisma.dataMappingRow.findMany({
        where: { verticalId },
        orderBy: { sNo: "asc" },
    });

    return NextResponse.json({ rows });
}
