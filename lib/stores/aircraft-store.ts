import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Aircraft, BoundingBox } from "@/lib/types/aircraft";
import { fetchAircraft, POLLING_INTERVALS } from "@/lib/services/opensky";

interface AircraftState {
    /** Current aircraft positions */
    aircraft: Aircraft[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Last successful update timestamp */
    lastUpdated: Date | null;
    /** Whether polling is active */
    isPolling: boolean;
    /** Polling interval ID */
    pollingIntervalId: ReturnType<typeof setInterval> | null;
    /** Current bounds for polling (if any) */
    bounds: BoundingBox | null;

    /** Fetch aircraft data */
    fetchAircraft: (bounds?: BoundingBox) => Promise<void>;
    /** Start polling for updates */
    startPolling: (intervalMs?: number, bounds?: BoundingBox) => void;
    /** Stop polling */
    stopPolling: () => void;
    /** Clear error */
    clearError: () => void;
    /** Set bounds for polling */
    setBounds: (bounds: BoundingBox | null) => void;
    /** Reset store state */
    reset: () => void;
}

const initialState = {
    aircraft: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isPolling: false,
    pollingIntervalId: null,
    bounds: null,
};

export const useAircraftStore = create<AircraftState>((set, get) => ({
    ...initialState,

    fetchAircraft: async (bounds?: BoundingBox) => {
        const state = get();
        const boundsToUse = bounds ?? state.bounds;

        set({ isLoading: true, error: null });

        try {
            const aircraft = await fetchAircraft(boundsToUse ?? undefined);
            set({
                aircraft,
                isLoading: false,
                lastUpdated: new Date(),
                error: null,
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to fetch aircraft data";
            set({
                isLoading: false,
                error: errorMessage,
            });
            console.error("Failed to fetch aircraft:", err);
        }
    },

    startPolling: (intervalMs = POLLING_INTERVALS.RECOMMENDED, bounds?: BoundingBox) => {
        const state = get();

        // Stop any existing polling
        if (state.pollingIntervalId) {
            clearInterval(state.pollingIntervalId);
        }

        // Set bounds if provided
        if (bounds) {
            set({ bounds });
        }

        // Set up polling interval
        const intervalId = setInterval(() => {
            get().fetchAircraft(bounds);
        }, intervalMs);

        set({
            isPolling: true,
            pollingIntervalId: intervalId,
        });

        // Initial fetch
        get().fetchAircraft(bounds);
    },

    stopPolling: () => {
        const state = get();
        if (state.pollingIntervalId) {
            clearInterval(state.pollingIntervalId);
        }
        set({
            isPolling: false,
            pollingIntervalId: null,
        });
    },

    clearError: () => {
        set({ error: null });
    },

    setBounds: (bounds) => {
        set({ bounds });
    },

    reset: () => {
        const state = get();
        if (state.pollingIntervalId) {
            clearInterval(state.pollingIntervalId);
        }
        set(initialState);
    },
}));

/**
 * Hook to get aircraft data (uses useShallow for stable references)
 */
export const useAircraft = () => useAircraftStore(useShallow((state) => ({
    aircraft: state.aircraft,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
})));

/**
 * Hook to get polling state (uses useShallow for stable references)
 */
export const useAircraftPolling = () => useAircraftStore(useShallow((state) => ({
    isPolling: state.isPolling,
    startPolling: state.startPolling,
    stopPolling: state.stopPolling,
})));

/**
 * Hook to get aircraft count
 */
export const useAircraftCount = () => useAircraftStore((state) => state.aircraft.length);

/**
 * Hook to get aircraft by ICAO24
 */
export const useAircraftByIcao = (icao24: string | null) =>
    useAircraftStore((state) =>
        icao24 ? state.aircraft.find((a) => a.icao24 === icao24) : null
    );

/**
 * Hook to get airborne aircraft only
 */
export const useAirborneAircraft = () =>
    useAircraftStore((state) => state.aircraft.filter((a) => !a.onGround));

/**
 * Hook to get on-ground aircraft only
 */
export const useGroundedAircraft = () =>
    useAircraftStore((state) => state.aircraft.filter((a) => a.onGround));