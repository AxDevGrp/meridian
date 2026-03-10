"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import * as Cesium from "cesium";
import {
    createGlobeViewer,
    destroyViewer,
    getCameraPosition,
    createAircraftCollection,
    updateAircraftPositions,
    clearAircraftCollection,
    destroyAircraftCollection,
    getAircraftAtPosition,
    type AircraftPrimitiveCollection,
} from "@/lib/cesium";
import { useGlobeStore } from "@/lib/stores/globe-store";
import type { Aircraft } from "@/lib/types/aircraft";
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
}

export const Globe = forwardRef<GlobeRef, GlobeProps>(
    ({ className, onViewerReady, aircraft = [], selectedAircraftIcao, onAircraftClick }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const viewerRef = useRef<Cesium.Viewer | null>(null);
        const aircraftCollectionRef = useRef<AircraftPrimitiveCollection | null>(null);

        const { setViewer, setCameraPosition, setIsLoading, setError } = useGlobeStore();

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

                    // Create aircraft collection for rendering
                    aircraftCollectionRef.current = createAircraftCollection(viewer);

                    setIsLoading(false);

                    if (onViewerReady) {
                        onViewerReady(viewer);
                    }
                } catch (err) {
                    if (mounted) {
                        const errorMessage = err instanceof Error ? err.message : "Failed to initialize globe";
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
                    // Clean up aircraft collection
                    if (aircraftCollectionRef.current) {
                        destroyAircraftCollection(viewerRef.current, aircraftCollectionRef.current);
                        aircraftCollectionRef.current = null;
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
                    if (viewerRef.current && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
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

            const updateCameraPosition = () => {
                if (viewerRef.current) {
                    const position = getCameraPosition(viewerRef.current);
                    setCameraPosition(position);
                }
            };

            // Update on camera move end
            const removeListener = viewerRef.current.camera.moveEnd.addEventListener(updateCameraPosition);

            return () => {
                removeListener();
            };
        }, [setCameraPosition]);

        // Update aircraft positions when data changes
        useEffect(() => {
            if (!aircraftCollectionRef.current) return;

            updateAircraftPositions(
                aircraftCollectionRef.current,
                aircraft,
                selectedAircraftIcao ?? undefined
            );
        }, [aircraft, selectedAircraftIcao]);

        // Handle aircraft click events
        useEffect(() => {
            if (!viewerRef.current || !onAircraftClick) return;

            const handler = new Cesium.ScreenSpaceEventHandler(viewerRef.current.canvas);

            handler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
                if (!viewerRef.current || !aircraftCollectionRef.current) return;

                const icao24 = getAircraftAtPosition(
                    viewerRef.current,
                    { x: event.position.x, y: event.position.y },
                    aircraftCollectionRef.current
                );

                if (icao24) {
                    onAircraftClick(icao24);
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

            return () => {
                handler.destroy();
            };
        }, [onAircraftClick]);

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