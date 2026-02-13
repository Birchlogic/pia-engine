import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/login", "/api/auth"];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths
    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Allow static files and Next.js internals
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // Check authentication
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        console.error("[Middleware] CRITICAL: NEXTAUTH_SECRET is not set in environment variables!");
    }

    const token = await getToken({
        req: request,
        secret: secret,
    });

    const allCookies = request.cookies.getAll().map(c => c.name).join(", ");
    console.log(`[Middleware] Debug Info:
    - Path: ${pathname}
    - Secret Configured: ${!!secret}
    - Cookies Present: ${allCookies}
    - Token Retrieved: ${!!token}
    `);

    if (!token) {
        console.log("[Middleware] No token found, redirecting to login");
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
