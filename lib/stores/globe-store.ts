import { create } from "zustand";
import * as Cesium from "cesium";

interface CameraPosition {
    longitude: number;
    latitude: number;
    height: number;
}

interface GlobeState {
    // Viewer instance - stored as ref since Cesium Viewer is not serializable
    viewer: Cesium.Viewer | null;
    setViewer: (viewer: Cesium.Viewer | null) => void;

    // Selected entity on the globe
    selectedEntity: Cesium.Entity | null;
    setSelectedEntity: (entity: Cesium.Entity | null) => void;

    // Current camera position
    cameraPosition: CameraPosition;
    setCameraPosition: (position: CameraPosition) => void;

    // Loading state
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;

    // Error state
    error: string | null;
    setError: (error: string | null) => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
    // Viewer
    viewer: null,
    setViewer: (viewer) => set({ viewer }),

    // Selected entity
    selectedEntity: null,
    setSelectedEntity: (selectedEntity) => set({ selectedEntity }),

    // Camera position
    cameraPosition: {
        longitude: 0,
        latitude: 20,
        height: 20000000,
    },
    setCameraPosition: (cameraPosition) => set({ cameraPosition }),

    // Loading state
    isLoading: true,
    setIsLoading: (isLoading) => set({ isLoading }),

    // Error state
    error: null,
    setError: (error) => set({ error }),
}));

/**
 * Hook to get the viewer instance
 * Use this to interact with the Cesium viewer from other components
 */
export const useViewer = () => useGlobeStore((state) => state.viewer);

/**
 * Hook to get/set the selected entity
 */
export const useSelectedEntity = () =>
    useGlobeStore((state) => ({
        selectedEntity: state.selectedEntity,
        setSelectedEntity: state.setSelectedEntity,
    }));

/**
 * Hook to get camera position
 */
export const useCameraPosition = () =>
    useGlobeStore((state) => state.cameraPosition);

/**
 * Hook to get loading state
 */
export const useGlobeLoading = () => useGlobeStore((state) => state.isLoading);