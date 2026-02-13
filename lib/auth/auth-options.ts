import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "@/lib/db/prisma";

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
                session.user.name = token.name;
                session.user.email = token.email;
                (session.user as { id: string }).id = token.id as string;
                (session.user as { role: string }).role = token.role as string;
                (session.user as { orgId: string | null }).orgId = token.orgId as string | null;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
};
