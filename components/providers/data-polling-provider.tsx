"use client";

import { useEffect } from "react";
import { useDataStore } from "@/lib/stores/data-store";
import { useLayerStore } from "@/lib/stores/layer-store";

/**
 * Data polling provider that manages fetching for all data sources
 * Starts/stops polling based on layer visibility
 */
export function DataPollingProvider({ children }: { children: React.ReactNode }) {
    const layers = useLayerStore((state) => state.layers);
    const startPolling = useDataStore((state) => state.startPolling);
    const stopPolling = useDataStore((state) => state.stopPolling);

    useEffect(() => {
        // Map layer IDs to store source names
        const layerToSource: Record<string, "vessels" | "satellites" | "conflicts" | "gpsJamming"> = {
            vessel: "vessels",
            satellite: "satellites",
            conflict: "conflicts",
            "gps-jamming": "gpsJamming",
        };

        for (const layer of layers) {
            const source = layerToSource[layer.id];
            if (!source) continue; // Skip aircraft (managed by existing provider)

            if (layer.enabled) {
                startPolling(source);
            } else {
                stopPolling(source);
            }
        }

        return () => {
            // Stop all polling on unmount
            Object.values(layerToSource).forEach((source) => stopPolling(source));
        };
        // Only re-run when layer enabled states change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layers.map((l) => `${l.id}:${l.enabled}`).join(",")]);

    return <>{children}</>;
}
