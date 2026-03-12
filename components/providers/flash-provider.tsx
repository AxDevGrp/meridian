"use client";

/**
 * Flash Alert Provider
 *
 * Monitors the social feed data store for new posts and runs them
 * through the flash detector to identify market-moving intelligence.
 * New flash alerts are pushed to the flash store for display.
 */

import { useEffect, useRef } from "react";
import { useDataStore } from "@/lib/stores/data-store";
import { useFlashStore } from "@/lib/stores/flash-store";
import { detectFlashAlerts } from "@/lib/services/flash-detector";

export function FlashProvider({ children }: { children: React.ReactNode }) {
    const socialPosts = useDataStore((s) => s.socialFeed.data);
    const addAlerts = useFlashStore((s) => s.addAlerts);
    const enabled = useFlashStore((s) => s.enabled);
    const prevCountRef = useRef(0);

    useEffect(() => {
        if (!enabled) return;
        if (socialPosts.length === 0) return;

        // Only run detection when new posts arrive
        if (socialPosts.length === prevCountRef.current) return;
        prevCountRef.current = socialPosts.length;

        const newAlerts = detectFlashAlerts(socialPosts);
        if (newAlerts.length > 0) {
            console.log(`[flash] Detected ${newAlerts.length} FLASH alert(s):`, newAlerts.map((a) => a.priority));
            addAlerts(newAlerts);
        }
    }, [socialPosts, addAlerts, enabled]);

    return <>{children}</>;
}
