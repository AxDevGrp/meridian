"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import * as Cesium from "cesium";
import {
    createGlobeViewer,
    destroyViewer,
    getCameraPosition,
    createAircraftCollection,
    updateAircraftPositions,
    destroyAircraftCollection,
    getAircraftAtPosition,
    type AircraftPrimitiveCollection,
} from "@/lib/cesium";
import {
    createAllLayerCollections,
    destroyAllLayerCollections,
    updateVesselPositions,
    updateSatellitePositions,
    updateConflictPositions,
    updateGPSJammingZones,
    setPrimitiveLayerVisibility,
    setEntityLayerVisibility,
    getEntityAtPosition,
    type AllLayerCollections,
} from "@/lib/cesium-layers";
import { useGlobeStore } from "@/lib/stores/globe-store";
import type { Aircraft } from "@/lib/types/aircraft";
import type { Vessel } from "@/lib/types/vessel";
import type { Satellite } from "@/lib/types/satellite";
import type { ConflictEvent } from "@/lib/types/conflict";
import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import type { LayerType } from "@/lib/types/geo-event";
import "cesium/Build/Cesium/Widgets/widgets.css";

export interface GlobeRef {
    viewer: Cesium.Viewer | null;
    flyTo: (longitude: number, latitude: number, height: number) => void;
    getCameraPosition: () => { longitude: number; latitude: number; height: number } | null;
}

interface GlobeProps {
    className?: string;
    onViewerReady?: (viewer: Cesium.Viewer) => void;
    /** Aircraft data to render on the globe */
    aircraft?: Aircraft[];
    /** Selected aircraft ICAO24 for highlighting */
    selectedAircraftIcao?: string | null;
    /** Callback when an aircraft is clicked */
    onAircraftClick?: (icao24: string) => void;
    /** Vessel data to render */
    vessels?: Vessel[];
    /** Satellite data to render */
    satellites?: Satellite[];
    /** Conflict event data to render */
    conflicts?: ConflictEvent[];
    /** GPS jamming zone data to render */
    gpsJammingZones?: GPSJammingZone[];
    /** Layer visibility state */
    layerVisibility?: Record<LayerType, boolean>;
    /** Selected entity (any layer) */
    selectedEntityId?: string | null;
    selectedEntityLayer?: LayerType | null;
    /** Callback when any entity is clicked */
    onEntityClick?: (layer: LayerType, id: string) => void;
}

export const Globe = forwardRef<GlobeRef, GlobeProps>(
    (
        {
            className,
            onViewerReady,
            aircraft = [],
            selectedAircraftIcao,
            onAircraftClick,
            vessels = [],
            satellites = [],
            conflicts = [],
            gpsJammingZones = [],
            layerVisibility,
            selectedEntityId,
            selectedEntityLayer,
            onEntityClick,
        },
        ref
    ) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const viewerRef = useRef<Cesium.Viewer | null>(null);
        const aircraftCollectionRef = useRef<AircraftPrimitiveCollection | null>(null);
        const layerCollectionsRef = useRef<AllLayerCollections | null>(null);
        const [viewerReady, setViewerReady] = useState(false);

        const setViewer = useGlobeStore((state) => state.setViewer);
        const setCameraPosition = useGlobeStore((state) => state.setCameraPosition);
        const setIsLoading = useGlobeStore((state) => state.setIsLoading);
        const setError = useGlobeStore((state) => state.setError);

        // Initialize viewer
        useEffect(() => {
            if (!containerRef.current) return;

            let mounted = true;

            const initViewer = async () => {
                try {
                    setIsLoading(true);
                    setError(null);

                    const viewer = await createGlobeViewer(containerRef.current!);

                    if (!mounted) {
                        destroyViewer(viewer);
                        return;
                    }

                    viewerRef.current = viewer;
                    setViewer(viewer);

                    // Create aircraft collection (Phase 1)
                    aircraftCollectionRef.current = createAircraftCollection(viewer);

                    // Create multi-source layer collections (Phase 2)
                    layerCollectionsRef.current = createAllLayerCollections(viewer);

                    setIsLoading(false);
                    setViewerReady(true);

                    if (onViewerReady) {
                        onViewerReady(viewer);
                    }
                } catch (err) {
                    if (mounted) {
                        const errorMessage =
                            err instanceof Error ? err.message : "Failed to initialize globe";
                        setError(errorMessage);
                        setIsLoading(false);
                        console.error("Globe initialization error:", err);
                    }
                }
            };

            initViewer();

            return () => {
                mounted = false;
                if (viewerRef.current) {
                    if (aircraftCollectionRef.current) {
                        destroyAircraftCollection(viewerRef.current, aircraftCollectionRef.current);
                        aircraftCollectionRef.current = null;
                    }
                    if (layerCollectionsRef.current) {
                        destroyAllLayerCollections(viewerRef.current, layerCollectionsRef.current);
                        layerCollectionsRef.current = null;
                    }
                    destroyViewer(viewerRef.current);
                    viewerRef.current = null;
                    setViewer(null);
                }
            };
        }, [setViewer, setIsLoading, setError, onViewerReady]);

        // Handle resize
        useEffect(() => {
            if (!containerRef.current) return;

            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (
                        viewerRef.current &&
                        entry.contentRect.width > 0 &&
                        entry.contentRect.height > 0
                    ) {
                        viewerRef.current.canvas.width = entry.contentRect.width;
                        viewerRef.current.canvas.height = entry.contentRect.height;
                        viewerRef.current.resize();
                    }
                }
            });

            resizeObserver.observe(containerRef.current);

            return () => {
                resizeObserver.disconnect();
            };
        }, []);

        // Update camera position periodically
        useEffect(() => {
            if (!viewerRef.current) return;

            const updateCameraPositionFn = () => {
                if (viewerRef.current) {
                    const position = getCameraPosition(viewerRef.current);
                    setCameraPosition(position);
                }
            };

            const removeListener =
                viewerRef.current.camera.moveEnd.addEventListener(updateCameraPositionFn);

            return () => {
                removeListener();
            };
        }, [setCameraPosition]);

        // Update aircraft positions
        useEffect(() => {
            if (!viewerReady || !aircraftCollectionRef.current) return;

            updateAircraftPositions(
                aircraftCollectionRef.current,
                aircraft,
                selectedAircraftIcao ?? undefined
            );
        }, [aircraft, selectedAircraftIcao, viewerReady]);

        // Update vessel positions
        useEffect(() => {
            if (!viewerReady || !layerCollectionsRef.current) return;

            const selectedVesselMmsi =
                selectedEntityLayer === "vessel" ? selectedEntityId ?? undefined : undefined;

            updateVesselPositions(
                layerCollectionsRef.current.vessels,
                vessels,
                selectedVesselMmsi
            );
        }, [vessels, selectedEntityId, selectedEntityLayer, viewerReady]);

        // Update satellite positions
        useEffect(() => {
            if (!viewerReady || !layerCollectionsRef.current) return;

            const selectedNoradId =
                selectedEntityLayer === "satellite" ? selectedEntityId ?? undefined : undefined;

            updateSatellitePositions(
                layerCollectionsRef.current.satellites,
                satellites,
                selectedNoradId
            );
        }, [satellites, selectedEntityId, selectedEntityLayer, viewerReady]);

        // Update conflict event positions
        useEffect(() => {
            if (!viewerReady || !layerCollectionsRef.current) return;

            const selectedConflictId =
                selectedEntityLayer === "conflict" ? selectedEntityId ?? undefined : undefined;

            updateConflictPositions(
                layerCollectionsRef.current.conflicts,
                conflicts,
                selectedConflictId
            );
        }, [conflicts, selectedEntityId, selectedEntityLayer, viewerReady]);

        // Update GPS jamming zones
        useEffect(() => {
            if (!viewerReady || !viewerRef.current || !layerCollectionsRef.current) return;

            const selectedZoneId =
                selectedEntityLayer === "gps-jamming" ? selectedEntityId ?? undefined : undefined;

            updateGPSJammingZones(
                viewerRef.current,
                layerCollectionsRef.current.gpsJamming,
                gpsJammingZones,
                selectedZoneId
            );
        }, [gpsJammingZones, selectedEntityId, selectedEntityLayer, viewerReady]);

        // Update layer visibility
        useEffect(() => {
            if (!viewerReady || !layerCollectionsRef.current || !aircraftCollectionRef.current || !layerVisibility) return;

            // Aircraft visibility
            aircraftCollectionRef.current.collection.show = layerVisibility.aircraft !== false;

            // Vessel visibility
            setPrimitiveLayerVisibility(
                layerCollectionsRef.current.vessels,
                layerVisibility.vessel !== false
            );

            // Satellite visibility
            setPrimitiveLayerVisibility(
                layerCollectionsRef.current.satellites,
                layerVisibility.satellite !== false
            );

            // Conflict visibility
            setPrimitiveLayerVisibility(
                layerCollectionsRef.current.conflicts,
                layerVisibility.conflict !== false
            );

            // GPS Jamming visibility
            setEntityLayerVisibility(
                layerCollectionsRef.current.gpsJamming,
                layerVisibility["gps-jamming"] !== false
            );
        }, [layerVisibility, viewerReady]);

        // Handle click events (multi-source)
        useEffect(() => {
            if (!viewerRef.current) return;

            const handler = new Cesium.ScreenSpaceEventHandler(viewerRef.current.canvas);

            handler.setInputAction(
                (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
                    if (!viewerRef.current) return;

                    const windowPos = { x: event.position.x, y: event.position.y };

                    // First check aircraft (Phase 1 collection)
                    if (aircraftCollectionRef.current && onAircraftClick) {
                        const icao24 = getAircraftAtPosition(
                            viewerRef.current,
                            windowPos,
                            aircraftCollectionRef.current
                        );
                        if (icao24) {
                            onAircraftClick(icao24);
                            return;
                        }
                    }

                    // Then check multi-source layers
                    if (layerCollectionsRef.current && onEntityClick) {
                        const result = getEntityAtPosition(
                            viewerRef.current,
                            windowPos,
                            layerCollectionsRef.current
                        );
                        if (result) {
                            onEntityClick(result.layer as LayerType, result.id);
                            return;
                        }
                    }
                },
                Cesium.ScreenSpaceEventType.LEFT_CLICK
            );

            return () => {
                handler.destroy();
            };
        }, [onAircraftClick, onEntityClick]);

        // Expose viewer via ref
        useImperativeHandle(
            ref,
            () => ({
                viewer: viewerRef.current,
                flyTo: (longitude: number, latitude: number, height: number) => {
                    if (viewerRef.current) {
                        viewerRef.current.camera.flyTo({
                            destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                            duration: 2,
                        });
                    }
                },
                getCameraPosition: () => {
                    if (viewerRef.current) {
                        return getCameraPosition(viewerRef.current);
                    }
                    return null;
                },
            }),
            []
        );

        return (
            <div
                ref={containerRef}
                className={className}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    ...(!className && {
                        minHeight: "400px",
                    }),
                }}
            />
        );
    }
);

Globe.displayName = "Globe";

export default Globe;
