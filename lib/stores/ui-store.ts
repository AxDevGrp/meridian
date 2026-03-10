import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

/**
 * Entity types that can be selected and inspected in the sidebar
 */
export type EntityType = "aircraft" | "vessel" | "conflict";

interface UIState {
    /** Currently selected entity type */
    selectedEntityType: EntityType | null;
    /** Currently selected entity ID (ICAO24 for aircraft, etc.) */
    selectedEntityId: string | null;
    /** Whether the sidebar is open */
    sidebarOpen: boolean;

    /** Select an entity and open the sidebar */
    selectEntity: (type: EntityType, id: string) => void;
    /** Deselect the current entity and close the sidebar */
    deselectEntity: () => void;
    /** Toggle sidebar visibility */
    toggleSidebar: () => void;
    /** Close the sidebar */
    closeSidebar: () => void;
}

const initialState = {
    selectedEntityType: null,
    selectedEntityId: null,
    sidebarOpen: false,
};

export const useUIStore = create<UIState>((set) => ({
    ...initialState,

    selectEntity: (type, id) =>
        set({
            selectedEntityType: type,
            selectedEntityId: id,
            sidebarOpen: true,
        }),

    deselectEntity: () =>
        set({
            selectedEntityType: null,
            selectedEntityId: null,
            sidebarOpen: false,
        }),

    toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    closeSidebar: () =>
        set({ sidebarOpen: false }),
}));

/**
 * Hook to get selected entity info
 */
export const useSelectedEntity = () =>
    useUIStore(useShallow((state) => ({
        type: state.selectedEntityType,
        id: state.selectedEntityId,
    })));

/**
 * Hook to check if sidebar is open
 */
export const useSidebarOpen = () => useUIStore((state) => state.sidebarOpen);

/**
 * Hook for sidebar actions
 */
export const useSidebarActions = () =>
    useUIStore(useShallow((state) => ({
        selectEntity: state.selectEntity,
        deselectEntity: state.deselectEntity,
        toggleSidebar: state.toggleSidebar,
        closeSidebar: state.closeSidebar,
    })));