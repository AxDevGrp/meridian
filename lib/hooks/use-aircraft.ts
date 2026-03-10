import { useEffect, useCallback, useRef } from "react";
import { useAircraftStore } from "@/lib/stores/aircraft-store";
import { POLLING_INTERVALS } from "@/lib/services/opensky";
import type { BoundingBox } from "@/lib/types/aircraft";

/**
 * Hook to manage aircraft data polling and state
 * Automatically starts polling when mounted and stops when unmounted
 *
 * @param options - Configuration options
 * @param options.autoStart - Whether to automatically start polling (default: true)
 * @param options.intervalMs - Polling interval in milliseconds (default: 15000)
 * @param options.bounds - Optional bounding box for geographic filtering
 * @returns Aircraft data and control functions
 */
export function useAircraft(options?: {
    autoStart?: boolean;
    intervalMs?: number;
    bounds?: BoundingBox;
}) {
    const {
        aircraft,
        isLoading,
        error,
        lastUpdated,
        isPolling,
        fetchAircraft,
        startPolling,
        stopPolling,
        clearError,
        setBounds,
    } = useAircraftStore();

    // Track if we started polling (for cleanup)
    const didStartPolling = useRef(false);

    const {
        autoStart = true,
        intervalMs = POLLING_INTERVALS.RECOMMENDED,
        bounds,
    } = options ?? {};

    // Set bounds when provided
    useEffect(() => {
        if (bounds) {
            setBounds(bounds);
        }
    }, [bounds, setBounds]);

    // Auto-start polling on mount - only run once
    useEffect(() => {
        if (autoStart) {
            didStartPolling.current = true;
            startPolling(intervalMs, bounds);
        }

        return () => {
            // Only stop polling if we started it
            if (didStartPolling.current) {
                stopPolling();
                didStartPolling.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, intervalMs]); // Intentionally exclude bounds, startPolling, stopPolling, isPolling

    // Manual fetch function
    const refetch = useCallback(() => {
        return fetchAircraft(bounds);
    }, [fetchAircraft, bounds]);

    return {
        // Data
        aircraft,
        aircraftCount: aircraft.length,
        airborneCount: aircraft.filter(a => !a.onGround).length,
        groundedCount: aircraft.filter(a => a.onGround).length,

        // Status
        isLoading,
        error,
        lastUpdated,
        isPolling,

        // Actions
        refetch,
        startPolling: () => startPolling(intervalMs, bounds),
        stopPolling,
        clearError,
    };
}

/**
 * Hook to get a single aircraft by ICAO24
 * @param icao24 - The ICAO24 address of the aircraft
 * @returns The aircraft if found, undefined otherwise
 */
export function useAircraftByIcao(icao24: string | null) {
    const aircraft = useAircraftStore((state) =>
        icao24 ? state.aircraft.find((a) => a.icao24 === icao24) : null
    );

    return aircraft;
}

/**
 * Hook to get aircraft statistics
 * @returns Statistics about current aircraft data
 */
export function useAircraftStats() {
    const stats = useAircraftStore((state) => {
        const { aircraft } = state;
        const withPosition = aircraft.filter(a => a.longitude !== null && a.latitude !== null);

        return {
            total: aircraft.length,
            airborne: withPosition.filter(a => !a.onGround).length,
            onGround: withPosition.filter(a => a.onGround).length,
            withPosition: withPosition.length,
            withAltitude: aircraft.filter(a => a.baroAltitude !== null || a.geoAltitude !== null).length,
            withVelocity: aircraft.filter(a => a.velocity !== null).length,
            withHeading: aircraft.filter(a => a.heading !== null).length,
        };
    });

    return stats;
}

/**
 * Hook to get aircraft within a geographic region
 * @param bounds - Geographic bounding box
 * @returns Aircraft within the bounds
 */
export function useAircraftInBounds(bounds: BoundingBox | null) {
    return useAircraftStore((state) => {
        if (!bounds) {
            return state.aircraft;
        }

        return state.aircraft.filter((a) => {
            if (a.longitude === null || a.latitude === null) {
                return false;
            }

            return (
                a.latitude >= bounds.lamin &&
                a.latitude <= bounds.lamax &&
                a.longitude >= bounds.lomin &&
                a.longitude <= bounds.lomax
            );
        });
    });
}