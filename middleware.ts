import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/login", "/api/auth", "/api/super-admin/login", "/api/super-admin/seed", "/super-admin", "/test-dfd", "/api/debug"];

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

    // Super Admin routes use their own JWT (verified in the route handlers)
    if (pathname.startsWith("/api/super-admin")) {
        return NextResponse.next();
    }

    // Check NextAuth authentication for all other routes
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
        console.error("[Middleware] CRITICAL: NEXTAUTH_SECRET is not set");
        return NextResponse.redirect(new URL("/login", request.url));
    }

    const token = await getToken({ req: request, secret });

    if (!token) {
        // API routes get a 401, page routes get redirected
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
