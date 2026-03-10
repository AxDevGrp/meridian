"use client";

import { useEffect, useRef } from "react";
import { useAircraftStore } from "@/lib/stores/aircraft-store";

/**
 * Provider component that initializes aircraft polling
 * This component ensures polling starts after all components have mounted
 */
export function AircraftPollingProvider({ children }: { children: React.ReactNode }) {
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        // Start polling after a short delay to ensure all components are mounted
        const timer = setTimeout(() => {
            useAircraftStore.getState().startPolling();
        }, 500);

        return () => {
            clearTimeout(timer);
            useAircraftStore.getState().stopPolling();
        };
    }, []);

    return <>{children}</>;
}