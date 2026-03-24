"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export function ActivityTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { data: session, status } = useSession();
    
    // Track previous path to avoid spamming the same path repeatedly
    const lastTrackedPath = useRef<string | null>(null);

    useEffect(() => {
        // Only track if authenticated (NextAuth session implies they are logged in)
        if (status !== "authenticated" || !session?.user) return;

        const currentPath = pathname;
        const currentQuery = searchParams.toString();
        const fullUrl = currentQuery ? `${currentPath}?${currentQuery}` : currentPath;

        if (lastTrackedPath.current === fullUrl) return;

        // Skip /api paths or static assets just in case
        if (currentPath.startsWith("/api") || currentPath.includes(".")) return;

        lastTrackedPath.current = fullUrl;

        // Dispatch frontend activity log
        fetch("/api/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "PAGE_VIEW",
                entityType: "AppRoute",
                entityId: "dashboard",
                details: { path: currentPath, query: currentQuery, fullUrl }
            })
        }).catch(err => console.error("ActivityTracker error:", err));

    }, [pathname, searchParams, session, status]);

    return null; // This component does not render anything
}
