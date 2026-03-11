import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { LayerType, LayerConfig } from "@/lib/types/geo-event";
import { DEFAULT_LAYERS } from "@/lib/types/geo-event";

/**
 * Layer visibility and configuration store
 * Controls which data source layers are visible on the globe
 */

interface LayerState {
    /** Layer configurations */
    layers: LayerConfig[];

    /** Toggle a layer's visibility */
    toggleLayer: (id: LayerType) => void;
    /** Enable a specific layer */
    enableLayer: (id: LayerType) => void;
    /** Disable a specific layer */
    disableLayer: (id: LayerType) => void;
    /** Enable all layers */
    enableAll: () => void;
    /** Disable all layers */
    disableAll: () => void;
    /** Check if a layer is enabled */
    isLayerEnabled: (id: LayerType) => boolean;
    /** Get count of enabled layers */
    getEnabledCount: () => number;
}

export const useLayerStore = create<LayerState>((set, get) => ({
    layers: DEFAULT_LAYERS,

    toggleLayer: (id) =>
        set((state) => ({
            layers: state.layers.map((layer) =>
                layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
            ),
        })),

    enableLayer: (id) =>
        set((state) => ({
            layers: state.layers.map((layer) =>
                layer.id === id ? { ...layer, enabled: true } : layer
            ),
        })),

    disableLayer: (id) =>
        set((state) => ({
            layers: state.layers.map((layer) =>
                layer.id === id ? { ...layer, enabled: false } : layer
            ),
        })),

    enableAll: () =>
        set((state) => ({
            layers: state.layers.map((layer) => ({ ...layer, enabled: true })),
        })),

    disableAll: () =>
        set((state) => ({
            layers: state.layers.map((layer) => ({ ...layer, enabled: false })),
        })),

    isLayerEnabled: (id) => {
        const layer = get().layers.find((l) => l.id === id);
        return layer?.enabled ?? false;
    },

    getEnabledCount: () => {
        return get().layers.filter((l) => l.enabled).length;
    },
}));

/**
 * Hook to get all layers
 */
export const useLayers = () => useLayerStore((state) => state.layers);

/**
 * Hook to check if a specific layer is enabled
 */
export const useLayerEnabled = (id: LayerType) =>
    useLayerStore((state) => state.layers.find((l) => l.id === id)?.enabled ?? false);

/**
 * Hook to get layer actions
 */
export const useLayerActions = () =>
    useLayerStore(
        useShallow((state) => ({
            toggleLayer: state.toggleLayer,
            enableLayer: state.enableLayer,
            disableLayer: state.disableLayer,
            enableAll: state.enableAll,
            disableAll: state.disableAll,
        }))
    );

/**
 * Hook to get enabled layer count
 */
export const useEnabledLayerCount = () =>
    useLayerStore((state) => state.layers.filter((l) => l.enabled).length);
