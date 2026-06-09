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
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Email and password are required");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    throw new Error("No user found with this email");
                }

                if (!user.isActive) {
                    throw new Error("Account has been deactivated. Contact your administrator.");
                }

                const isValid = await compare(credentials.password, user.password);
                if (!isValid) {
                    throw new Error("Invalid password");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    orgId: user.orgId,
                };
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
                token.id = user.id;
                token.name = user.name;
                token.email = user.email;
                token.role = (user as { role: string }).role;
                token.orgId = (user as { orgId: string | null }).orgId;
            }
            return token;
        },
        async session({ session, token }) {
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
    secret: process.env.NEXTAUTH_SECRET,
};
