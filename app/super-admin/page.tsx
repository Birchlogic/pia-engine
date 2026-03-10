"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SuperAdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [seeding, setSeeding] = useState(true);

    // Auto-seed SuperAdmin on page load
    useEffect(() => {
        async function seedAdmin() {
            try {
                await fetch("/api/super-admin/seed");
            } catch {
                // Ignore seed errors
            } finally {
                setSeeding(false);
            }
        }
        seedAdmin();
    }, []);

    // Check if already logged in
    useEffect(() => {
        const token = localStorage.getItem("superAdminToken");
        if (token) {
            router.push("/super-admin/dashboard");
        }
    }, [router]);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/super-admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!data.success) {
                setError(data.message || "Login failed");
                return;
            }

            localStorage.setItem("superAdminToken", data.data.token);
            localStorage.setItem("superAdminEmail", data.data.email);
            router.push("/super-admin/dashboard");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
            <Card className="relative w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
                <CardHeader className="space-y-3 text-center">
                    <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-8 h-8 text-primary"
                        >
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Super Admin</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        Platform Management
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {seeding && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center mb-6">
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Initializing...
                        </div>
                    )}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 text-center">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="uppercase text-xs tracking-wider text-muted-foreground">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@kaizen.ai"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="uppercase text-xs tracking-wider text-muted-foreground">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full mt-2" disabled={loading || seeding}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Authenticating...
                                </span>
                            ) : (
                                "Sign in"
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t border-border/50 pt-6 mt-2">
                    <p className="text-xs text-muted-foreground">
                        This portal is restricted to platform administrators only.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
