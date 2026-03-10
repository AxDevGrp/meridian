import * as Cesium from "cesium";
import type { Aircraft } from "@/lib/types/aircraft";

// Configure Cesium base URL for static assets
// In Next.js, these are served from the public folder
if (typeof window !== "undefined") {
    (window as unknown as { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";
}

// Track if we've set the token
let tokenSet = false;

/**
 * Set the Cesium Ion access token
 * This must be called before creating a viewer
 */
function setCesiumIonToken(): void {
    if (tokenSet) return;

    // Get token from environment variable
    const cesiumIonToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

    if (cesiumIonToken) {
        Cesium.Ion.defaultAccessToken = cesiumIonToken;
        tokenSet = true;
    } else {
        console.warn("Cesium Ion token not set. Set NEXT_PUBLIC_CESIUM_ION_TOKEN environment variable.");
    }
}

// Aircraft rendering colors
const AIRCRAFT_COLORS = {
    airborne: Cesium.Color.fromCssColorString("#00ff88"), // Bright green for airborne
    onGround: Cesium.Color.fromCssColorString("#ffaa00"), // Orange for on-ground
    selected: Cesium.Color.fromCssColorString("#ff0066"), // Pink for selected
    outline: Cesium.Color.WHITE.withAlpha(0.8),
};

// Store for aircraft point primitives
export interface AircraftPrimitiveCollection {
    collection: Cesium.PointPrimitiveCollection;
    aircraftMap: Map<string, Cesium.PointPrimitive>;
}

/**
 * Initialize Cesium Viewer with Google Photorealistic 3D Tiles
 * @param container - The HTML element or ID to contain the viewer
 * @param options - Optional viewer configuration options
 * @returns Cesium.Viewer instance
 */
export async function createGlobeViewer(
    container: string | HTMLElement,
    options?: Partial<Cesium.Viewer.ConstructorOptions>
): Promise<Cesium.Viewer> {
    // Ensure Cesium Ion token is set before creating viewer
    setCesiumIonToken();

    const viewer = new Cesium.Viewer(container, {
        // Use terrain provider for 3D terrain
        terrain: Cesium.Terrain.fromWorldTerrain(),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        vrButton: false,
        infoBox: true,
        selectionIndicator: true,
        shadows: false,
        shouldAnimate: true,
        ...options,
    });

    // Load Google Photorealistic 3D Tiles
    try {
        // Google Photorealistic 3D Tiles asset ID
        const googleTiles = await Cesium.IonImageryProvider.fromAssetId(2275207);
        viewer.imageryLayers.addImageryProvider(googleTiles);
    } catch (error) {
        console.warn("Failed to load Google Photorealistic 3D Tiles:", error);
        // Fall back to default imagery
    }

    // Set initial camera position to show the whole Earth
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
        duration: 0,
    });

    return viewer;
}

/**
 * Get the current camera position from a viewer
 * @param viewer - Cesium.Viewer instance
 * @returns Object containing longitude, latitude, and height
 */
export function getCameraPosition(viewer: Cesium.Viewer): {
    longitude: number;
    latitude: number;
    height: number;
} {
    const cartographic = viewer.camera.positionCartographic;
    return {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
    };
}

/**
 * Fly the camera to a specific position
 * @param viewer - Cesium.Viewer instance
 * @param longitude - Longitude in degrees
 * @param latitude - Latitude in degrees
 * @param height - Height in meters
 * @param duration - Flight duration in seconds (default: 2)
 */
export function flyToPosition(
    viewer: Cesium.Viewer,
    longitude: number,
    latitude: number,
    height: number,
    duration: number = 2
): void {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        duration,
    });
}

/**
 * Add a point entity to the viewer
 * @param viewer - Cesium.Viewer instance
 * @param longitude - Longitude in degrees
 * @param latitude - Latitude in degrees
 * @param options - Optional point styling options
 * @returns The created entity
 */
export function addPoint(
    viewer: Cesium.Viewer,
    longitude: number,
    latitude: number,
    options?: {
        color?: Cesium.Color;
        pixelSize?: number;
        outlineColor?: Cesium.Color;
        outlineWidth?: number;
    }
): Cesium.Entity {
    return viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
        point: {
            pixelSize: options?.pixelSize ?? 10,
            color: options?.color ?? Cesium.Color.RED,
            outlineColor: options?.outlineColor ?? Cesium.Color.WHITE,
            outlineWidth: options?.outlineWidth ?? 2,
        },
    });
}

/**
 * Clean up and destroy a viewer instance
 * @param viewer - Cesium.Viewer instance to destroy
 */
export function destroyViewer(viewer: Cesium.Viewer): void {
    if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
    }
}

// ============================================
// Aircraft Rendering Functions
// ============================================

/**
 * Create a primitive collection for aircraft rendering
 * Uses PointPrimitiveCollection for better performance with many aircraft
 * @param viewer - Cesium.Viewer instance
 * @returns AircraftPrimitiveCollection for managing aircraft points
 */
export function createAircraftCollection(viewer: Cesium.Viewer): AircraftPrimitiveCollection {
    const collection = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);

    return {
        collection,
        aircraftMap: new Map<string, Cesium.PointPrimitive>(),
    };
}

/**
 * Add or update aircraft entities on the globe
 * Uses PointPrimitiveCollection for efficient rendering of many aircraft
 * @param aircraftCollection - The aircraft primitive collection
 * @param aircraft - Array of aircraft to render
 * @param selectedIcao24 - Optional ICAO24 of selected aircraft for highlighting
 */
export function updateAircraftPositions(
    aircraftCollection: AircraftPrimitiveCollection,
    aircraft: Aircraft[],
    selectedIcao24?: string
): void {
    const { collection, aircraftMap } = aircraftCollection;

    // Track which aircraft we've seen
    const seenIcao24 = new Set<string>();

    // Update or add each aircraft
    for (const plane of aircraft) {
        // Skip aircraft without valid position
        if (plane.longitude === null || plane.latitude === null) {
            continue;
        }

        seenIcao24.add(plane.icao24);

        // Calculate altitude (use baroAltitude or geoAltitude, default to 0)
        const altitude = plane.baroAltitude ?? plane.geoAltitude ?? 0;

        // Determine color based on state
        const color = plane.icao24 === selectedIcao24
            ? AIRCRAFT_COLORS.selected
            : plane.onGround
                ? AIRCRAFT_COLORS.onGround
                : AIRCRAFT_COLORS.airborne;

        // Position with altitude
        const position = Cesium.Cartesian3.fromDegrees(
            plane.longitude,
            plane.latitude,
            altitude
        );

        // Check if we already have this aircraft
        const existingPoint = aircraftMap.get(plane.icao24);

        if (existingPoint) {
            // Update existing point
            existingPoint.position = position;
            existingPoint.color = color;
        } else {
            // Add new point
            const point = collection.add({
                position,
                pixelSize: 6,
                color,
                outlineColor: AIRCRAFT_COLORS.outline,
                outlineWidth: 1,
                id: plane.icao24,
            });
            aircraftMap.set(plane.icao24, point);
        }
    }

    // Remove aircraft that are no longer in the data
    for (const [icao24, point] of aircraftMap) {
        if (!seenIcao24.has(icao24)) {
            collection.remove(point);
            aircraftMap.delete(icao24);
        }
    }
}

/**
 * Remove all aircraft from the collection
 * @param aircraftCollection - The aircraft primitive collection
 */
export function clearAircraftCollection(aircraftCollection: AircraftPrimitiveCollection): void {
    const { collection, aircraftMap } = aircraftCollection;
    collection.removeAll();
    aircraftMap.clear();
}

/**
 * Remove aircraft collection from viewer
 * @param viewer - Cesium.Viewer instance
 * @param aircraftCollection - The aircraft primitive collection to remove
 */
export function destroyAircraftCollection(
    viewer: Cesium.Viewer,
    aircraftCollection: AircraftPrimitiveCollection
): void {
    const { collection } = aircraftCollection;
    if (!collection.isDestroyed()) {
        viewer.scene.primitives.remove(collection);
        collection.destroy();
    }
}

/**
 * Get aircraft statistics for display
 * @param aircraft - Array of aircraft
 * @returns Object with counts
 */
export function getAircraftStats(aircraft: Aircraft[]): {
    total: number;
    airborne: number;
    onGround: number;
    withPosition: number;
} {
    const withPosition = aircraft.filter(a => a.longitude !== null && a.latitude !== null);

    return {
        total: aircraft.length,
        airborne: withPosition.filter(a => !a.onGround).length,
        onGround: withPosition.filter(a => a.onGround).length,
        withPosition: withPosition.length,
    };
}

/**
 * Fly to an aircraft position
 * @param viewer - Cesium.Viewer instance
 * @param aircraft - Aircraft to fly to
 * @param duration - Flight duration in seconds (default: 2)
 */
export function flyToAircraft(
    viewer: Cesium.Viewer,
    aircraft: Aircraft,
    duration: number = 2
): void {
    if (aircraft.longitude === null || aircraft.latitude === null) {
        return;
    }

    const altitude = (aircraft.baroAltitude ?? aircraft.geoAltitude ?? 10000) + 5000;

    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
            aircraft.longitude,
            aircraft.latitude,
            altitude
        ),
        duration,
    });
}

/**
 * Get aircraft at a screen position (for click handling)
 * @param viewer - Cesium.Viewer instance
 * @param windowPosition - Screen position (x, y)
 * @param aircraftCollection - The aircraft primitive collection
 * @returns ICAO24 of the aircraft at the position, or null
 */
export function getAircraftAtPosition(
    viewer: Cesium.Viewer,
    windowPosition: { x: number; y: number },
    aircraftCollection: AircraftPrimitiveCollection
): string | null {
    const { aircraftMap } = aircraftCollection;

    // Pick the primitive at the position
    const pickedObject = viewer.scene.pick(
        new Cesium.Cartesian2(windowPosition.x, windowPosition.y)
    );

    if (pickedObject && pickedObject.primitive) {
        // Check if the picked primitive is in our aircraft map
        for (const [icao24, point] of aircraftMap) {
            if (point === pickedObject.primitive) {
                return icao24;
            }
        }
    }

    return null;
}

export { Cesium };