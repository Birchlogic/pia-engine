import { NextResponse } from "next/server";

export async function GET() {
    const envVars = {
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "NOT_SET",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "NOT_SET",
        DATABASE_URL: process.env.DATABASE_URL || "NOT_SET",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "NOT_SET",
        NODE_ENV: process.env.NODE_ENV || "NOT_SET",
        VERCEL_ENV: process.env.VERCEL_ENV || "NOT_SET",
        VERCEL_URL: process.env.VERCEL_URL || "NOT_SET"
    };

    return NextResponse.json(envVars);
}
