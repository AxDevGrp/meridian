import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Vessel } from "@/lib/types/vessel";
import type { Satellite } from "@/lib/types/satellite";
import type { ConflictEvent } from "@/lib/types/conflict";
import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import type { SocialPost } from "@/lib/types/social-post";
import { fetchVessels, VESSEL_POLLING } from "@/lib/services/vessels";
import { fetchMultipleSatelliteGroups, SATELLITE_POLLING } from "@/lib/services/satellites";
import { fetchConflicts, CONFLICT_POLLING } from "@/lib/services/conflicts";
import { fetchGPSJammingZones, GPS_JAMMING_POLLING } from "@/lib/services/gps-jamming";
import { fetchSocialFeed, SOCIAL_FEED_POLLING } from "@/lib/services/social-feed";

/**
 * Unified data store for all non-aircraft data sources
 * Each source has its own data array, loading state, and polling controls
 */

interface SourceState<T> {
    data: T[];
    isLoading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    isSampleData: boolean;
}

interface DataState {
    // Data sources
    vessels: SourceState<Vessel>;
    satellites: SourceState<Satellite>;
    conflicts: SourceState<ConflictEvent>;
    gpsJamming: SourceState<GPSJammingZone>;
    socialFeed: SourceState<SocialPost>;

    // Polling state
    pollingIntervals: Record<string, ReturnType<typeof setInterval> | null>;

    // Actions - Fetch
    fetchVessels: () => Promise<void>;
    fetchSatellites: () => Promise<void>;
    fetchConflicts: () => Promise<void>;
    fetchGPSJamming: () => Promise<void>;
    fetchSocialFeed: () => Promise<void>;
    fetchAll: () => Promise<void>;

    // Actions - Polling
    startPolling: (source: "vessels" | "satellites" | "conflicts" | "gpsJamming" | "socialFeed") => void;
    stopPolling: (source: "vessels" | "satellites" | "conflicts" | "gpsJamming" | "socialFeed") => void;
    startAllPolling: () => void;
    stopAllPolling: () => void;

    // Reset
    reset: () => void;
}

const createInitialSourceState = <T>(): SourceState<T> => ({
    data: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isSampleData: false,
});

const initialState = {
    vessels: createInitialSourceState<Vessel>(),
    satellites: createInitialSourceState<Satellite>(),
    conflicts: createInitialSourceState<ConflictEvent>(),
    gpsJamming: createInitialSourceState<GPSJammingZone>(),
    socialFeed: createInitialSourceState<SocialPost>(),
    pollingIntervals: {} as Record<string, ReturnType<typeof setInterval> | null>,
};

export const useDataStore = create<DataState>((set, get) => ({
    ...initialState,

    // === Fetch Actions ===

    fetchVessels: async () => {
        set((state) => ({
            vessels: { ...state.vessels, isLoading: true, error: null },
        }));

        try {
            const result = await fetchVessels();
            set({
                vessels: {
                    data: result.vessels,
                    isLoading: false,
                    error: null,
                    lastUpdated: new Date(),
                    isSampleData: result.isSampleData,
                },
            });
        } catch (err) {
            set((state) => ({
                vessels: {
                    ...state.vessels,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch vessels",
                },
            }));
        }
    },

    fetchSatellites: async () => {
        set((state) => ({
            satellites: { ...state.satellites, isLoading: true, error: null },
        }));

        try {
            const satellites = await fetchMultipleSatelliteGroups(
                ["stations", "visual", "gps-ops"],
                30
            );
            set({
                satellites: {
                    data: satellites,
                    isLoading: false,
                    error: null,
                    lastUpdated: new Date(),
                    isSampleData: false,
                },
            });
        } catch (err) {
            set((state) => ({
                satellites: {
                    ...state.satellites,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch satellites",
                },
            }));
        }
    },

    fetchConflicts: async () => {
        set((state) => ({
            conflicts: { ...state.conflicts, isLoading: true, error: null },
        }));

        try {
            const result = await fetchConflicts({ limit: 100, days: 7 });
            set({
                conflicts: {
                    data: result.events,
                    isLoading: false,
                    error: null,
                    lastUpdated: new Date(),
                    isSampleData: result.isSampleData,
                },
            });
        } catch (err) {
            set((state) => ({
                conflicts: {
                    ...state.conflicts,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch conflicts",
                },
            }));
        }
    },

    fetchGPSJamming: async () => {
        set((state) => ({
            gpsJamming: { ...state.gpsJamming, isLoading: true, error: null },
        }));

        try {
            const result = await fetchGPSJammingZones({ activeOnly: true });
            set({
                gpsJamming: {
                    data: result.zones,
                    isLoading: false,
                    error: null,
                    lastUpdated: new Date(),
                    isSampleData: result.isSampleData,
                },
            });
        } catch (err) {
            set((state) => ({
                gpsJamming: {
                    ...state.gpsJamming,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch GPS jamming",
                },
            }));
        }
    },

    fetchSocialFeed: async () => {
        set((state) => ({
            socialFeed: { ...state.socialFeed, isLoading: true, error: null },
        }));

        try {
            const result = await fetchSocialFeed({ limit: 50 });
            set({
                socialFeed: {
                    data: result.posts,
                    isLoading: false,
                    error: null,
                    lastUpdated: new Date(),
                    isSampleData: result.isSampleData,
                },
            });
        } catch (err) {
            set((state) => ({
                socialFeed: {
                    ...state.socialFeed,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Failed to fetch social feed",
                },
            }));
        }
    },

    fetchAll: async () => {
        const state = get();
        await Promise.allSettled([
            state.fetchVessels(),
            state.fetchSatellites(),
            state.fetchConflicts(),
            state.fetchGPSJamming(),
            state.fetchSocialFeed(),
        ]);
    },

    // === Polling Actions ===

    startPolling: (source) => {
        const state = get();
        const existing = state.pollingIntervals[source];
        if (existing) clearInterval(existing);

        const intervals: Record<string, number> = {
            vessels: VESSEL_POLLING.STANDARD,
            satellites: SATELLITE_POLLING.STANDARD,
            conflicts: CONFLICT_POLLING.STANDARD,
            gpsJamming: GPS_JAMMING_POLLING.STANDARD,
            socialFeed: SOCIAL_FEED_POLLING.STANDARD,
        };

        const fetchFns: Record<string, () => Promise<void>> = {
            vessels: state.fetchVessels,
            satellites: state.fetchSatellites,
            conflicts: state.fetchConflicts,
            gpsJamming: state.fetchGPSJamming,
            socialFeed: state.fetchSocialFeed,
        };

        // Initial fetch
        fetchFns[source]();

        const intervalId = setInterval(() => {
            get()[`fetch${source.charAt(0).toUpperCase()}${source.slice(1)}` as keyof DataState] &&
                fetchFns[source]();
        }, intervals[source]);

        set((state) => ({
            pollingIntervals: {
                ...state.pollingIntervals,
                [source]: intervalId,
            },
        }));
    },

    stopPolling: (source) => {
        const state = get();
        const interval = state.pollingIntervals[source];
        if (interval) {
            clearInterval(interval);
            set((state) => ({
                pollingIntervals: {
                    ...state.pollingIntervals,
                    [source]: null,
                },
            }));
        }
    },

    startAllPolling: () => {
        const state = get();
        (["vessels", "satellites", "conflicts", "gpsJamming", "socialFeed"] as const).forEach((source) => {
            state.startPolling(source);
        });
    },

    stopAllPolling: () => {
        const state = get();
        Object.entries(state.pollingIntervals).forEach(([source]) => {
            state.stopPolling(source as "vessels" | "satellites" | "conflicts" | "gpsJamming" | "socialFeed");
        });
    },

    reset: () => {
        const state = get();
        state.stopAllPolling();
        set(initialState);
    },
}));

// === Selector Hooks ===

export const useVessels = () =>
    useDataStore(
        useShallow((state) => ({
            vessels: state.vessels.data,
            isLoading: state.vessels.isLoading,
            error: state.vessels.error,
            lastUpdated: state.vessels.lastUpdated,
            isSampleData: state.vessels.isSampleData,
        }))
    );

export const useSatellites = () =>
    useDataStore(
        useShallow((state) => ({
            satellites: state.satellites.data,
            isLoading: state.satellites.isLoading,
            error: state.satellites.error,
            lastUpdated: state.satellites.lastUpdated,
        }))
    );

export const useConflicts = () =>
    useDataStore(
        useShallow((state) => ({
            conflicts: state.conflicts.data,
            isLoading: state.conflicts.isLoading,
            error: state.conflicts.error,
            lastUpdated: state.conflicts.lastUpdated,
            isSampleData: state.conflicts.isSampleData,
        }))
    );

export const useGPSJamming = () =>
    useDataStore(
        useShallow((state) => ({
            zones: state.gpsJamming.data,
            isLoading: state.gpsJamming.isLoading,
            error: state.gpsJamming.error,
            lastUpdated: state.gpsJamming.lastUpdated,
        }))
    );

/** Get entity counts across all sources */
export const useEntityCounts = () =>
    useDataStore(
        useShallow((state) => ({
            vessels: state.vessels.data.length,
            satellites: state.satellites.data.length,
            conflicts: state.conflicts.data.length,
            gpsJamming: state.gpsJamming.data.length,
            socialFeed: state.socialFeed.data.length,
        }))
    );

/** Get a vessel by MMSI */
export const useVesselByMmsi = (mmsi: string | null) =>
    useDataStore((state) =>
        mmsi ? state.vessels.data.find((v) => v.mmsi === mmsi) : undefined
    );

/** Get a satellite by NORAD ID */
export const useSatelliteByNoradId = (noradId: string | null) =>
    useDataStore((state) =>
        noradId ? state.satellites.data.find((s) => s.noradId === noradId) : undefined
    );

/** Get a conflict event by ID */
export const useConflictById = (eventId: string | null) =>
    useDataStore((state) =>
        eventId ? state.conflicts.data.find((c) => c.eventId === eventId) : undefined
    );

/** Get a GPS jamming zone by ID */
export const useGPSJammingZoneById = (zoneId: string | null) =>
    useDataStore((state) =>
        zoneId ? state.gpsJamming.data.find((z) => z.id === zoneId) : undefined
    );

/** Get social feed data with loading state */
export const useSocialFeed = () =>
    useDataStore(
        useShallow((state) => ({
            posts: state.socialFeed.data,
            isLoading: state.socialFeed.isLoading,
            error: state.socialFeed.error,
            lastUpdated: state.socialFeed.lastUpdated,
            isSampleData: state.socialFeed.isSampleData,
        }))
    );

/** Get a social post by ID */
export const useSocialPostById = (postId: string | null) =>
    useDataStore((state) =>
        postId ? state.socialFeed.data.find((p) => p.id === postId) : undefined
    );
