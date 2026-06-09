import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { logActivity } from "@/lib/activity";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                console.log("[Auth] Authorize - Starting authentication");
                console.log("[Auth] Authorize - Email provided:", credentials?.email);
                console.log("[Auth] Authorize - DATABASE_URL exists:", !!process.env.DATABASE_URL);
                console.log("[Auth] Authorize - DATABASE_URL length:", process.env.DATABASE_URL?.length || 0);
                
                if (!credentials?.email || !credentials?.password) {
                    console.log("[Auth] Authorize - Missing credentials");
                    throw new Error("Email and password are required");
                }

                try {
                    console.log("[Auth] Authorize - Looking up user in database");
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email },
                    });
                    console.log("[Auth] Authorize - User found:", !!user);

                    if (!user) {
                        console.log("[Auth] Authorize - No user found with email:", credentials.email);
                        throw new Error("No user found with this email");
                    }

                    if (!user.isActive) {
                        console.log("[Auth] Authorize - User account deactivated");
                        throw new Error("Account has been deactivated. Contact your administrator.");
                    }

                    console.log("[Auth] Authorize - Comparing password");
                    const isValid = await compare(credentials.password, user.password);
                    console.log("[Auth] Authorize - Password valid:", isValid);
                    
                    if (!isValid) {
                        console.log("[Auth] Authorize - Invalid password");
                        throw new Error("Invalid password");
                    }

                    console.log("[Auth] Authorize - Authentication successful for:", user.email);
                    return {
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        orgId: user.orgId,
                    };
                } catch (error) {
                    console.error("[Auth] Authorize - Database error:", error);
                    throw error;
                }
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                console.log("[Auth] JWT Callback - User found:", user.email);
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.role = (user as { role: string }).role;
                token.orgId = (user as { orgId: string | null }).orgId;
            }
            return token;
        },
        async session({ session, token }) {
            console.log("[Auth] Session Callback - Token:", token.email);
            if (session.user) {
                if (typeof token.name === "string") session.user.name = token.name;
                if (typeof token.email === "string") session.user.email = token.email;
                (session.user as { id: string }).id = token.id as string;
                (session.user as { role: string }).role = token.role as string;
                (session.user as { orgId: string | null }).orgId = token.orgId as string | null;
            }
            return session;
        },
    },
    events: {
        async signIn({ user }) {
            try {
                // Ensure we have an ID and an explicit logActivity call
                if (user && user.id) {
                    await logActivity({
                        userId: user.id,
                        action: "USER_LOGIN",
                        entityType: "User",
                        entityId: user.id,
                        details: {
                            email: user.email,
                            role: (user as any).role,
                        },
                        orgId: (user as any).orgId,
                    });
                }
            } catch (e) {
                console.error("[Auth Event] Failed to log signIn activity:", e);
            }
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: (() => {
        console.log("[Auth] NEXTAUTH_SECRET exists:", !!process.env.NEXTAUTH_SECRET);
        console.log("[Auth] NEXTAUTH_SECRET length:", process.env.NEXTAUTH_SECRET?.length || 0);
        console.log("[Auth] NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
        return process.env.NEXTAUTH_SECRET;
    })(),
};
