import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// ─── Types ───

export interface SuperAdminJWTPayload extends JWTPayload {
    adminId: string;
    email: string;
    isSuperAdmin: true;
}

// ─── Config ───

function getSecret(): Uint8Array {
    const secret = process.env.SUPER_ADMIN_JWT_SECRET;
    if (!secret) {
        throw new Error("SUPER_ADMIN_JWT_SECRET is not set in environment variables");
    }
    return new TextEncoder().encode(secret);
}

const TOKEN_EXPIRY = "8h";

// ─── Sign ───

export async function signSuperAdminToken(
    adminId: string,
    email: string
): Promise<string> {
    return new SignJWT({ adminId, email, isSuperAdmin: true as const })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(getSecret());
}

// ─── Verify ───

export async function verifySuperAdminToken(
    token: string
): Promise<SuperAdminJWTPayload> {
    try {
        const { payload } = await jwtVerify(token, getSecret());

        if (!payload.isSuperAdmin || !payload.adminId || !payload.email) {
            throw new Error("Invalid super admin token payload");
        }

        return payload as SuperAdminJWTPayload;
    } catch {
        throw new Error("Invalid or expired super admin token");
    }
}

// ─── Extract from Request ───

export function extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    return authHeader.slice(7);
}
