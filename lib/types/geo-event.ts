/**
 * Unified GeoEvent format for all data sources
 * Every data source normalizes its output into this base format
 */

/**
 * Supported data source layer types
 */
export type LayerType = "aircraft" | "vessel" | "satellite" | "conflict" | "gps-jamming" | "social";

/**
 * Severity levels for events (used for conflict events, GPS jamming, etc.)
 */
export type Severity = "critical" | "high" | "medium" | "low" | "info";

/**
 * Geometry types for rendering on the globe
 */
export type GeoGeometry =
    | { type: "point"; coordinates: [number, number, number?] } // [lng, lat, alt?]
    | { type: "polygon"; coordinates: [number, number][] }       // Array of [lng, lat]
    | { type: "circle"; center: [number, number]; radius: number }; // center [lng, lat], radius in meters

/**
 * Base interface for all geospatial events
 * Every data source entity must conform to this interface
 */
export interface GeoEvent {
    /** Unique identifier for this event */
    id: string;
    /** Data source layer type */
    layer: LayerType;
    /** Display name / label */
    name: string;
    /** Short description */
    description?: string;
    /** Geographic geometry for rendering */
    geometry: GeoGeometry;
    /** Event severity (null for non-event entities like aircraft) */
    severity?: Severity;
    /** ISO 8601 timestamp when this event/observation occurred */
    timestamp: string;
    /** Source attribution */
    source: string;
    /** Additional metadata specific to the data source */
    metadata: Record<string, unknown>;
}

/**
 * GeoJSON Feature format for standardized output
 */
export interface GeoJSONFeature {
    type: "Feature";
    geometry: {
        type: "Point" | "Polygon" | "MultiPoint";
        coordinates: number[] | number[][] | number[][][];
    };
    properties: {
        id: string;
        layer: LayerType;
        name: string;
        description?: string;
        severity?: Severity;
        timestamp: string;
        source: string;
        [key: string]: unknown;
    };
}

/**
 * GeoJSON FeatureCollection for batch responses
 */
export interface GeoJSONFeatureCollection {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
    metadata?: {
        timestamp: string;
        source: string;
        count: number;
    };
}

/**
 * Convert a GeoEvent to a GeoJSON Feature
 */
export function geoEventToFeature(event: GeoEvent): GeoJSONFeature {
    let geometry: GeoJSONFeature["geometry"];

    switch (event.geometry.type) {
        case "point":
            geometry = {
                type: "Point",
                coordinates: event.geometry.coordinates.filter((c): c is number => c !== undefined),
            };
            break;
        case "polygon":
            geometry = {
                type: "Polygon",
                coordinates: [event.geometry.coordinates],
            };
            break;
        case "circle":
            // Approximate circle as a polygon with 32 points
            geometry = {
                type: "Polygon",
                coordinates: [approximateCircle(event.geometry.center, event.geometry.radius)],
            };
            break;
    }

    return {
        type: "Feature",
        geometry,
        properties: {
            id: event.id,
            layer: event.layer,
            name: event.name,
            description: event.description,
            severity: event.severity,
            timestamp: event.timestamp,
            source: event.source,
            ...event.metadata,
        },
    };
}

/**
 * Approximate a circle as a polygon with the given number of points
 */
function approximateCircle(
    center: [number, number],
    radiusMeters: number,
    numPoints: number = 32
): number[][] {
    const [lng, lat] = center;
    const points: number[][] = [];

    // Approximate meters to degrees (rough, good enough for visualization)
    const latDeg = radiusMeters / 111320;
    const lngDeg = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        points.push([
            lng + lngDeg * Math.cos(angle),
            lat + latDeg * Math.sin(angle),
        ]);
    }

    return points;
}

/**
 * Layer configuration for rendering
 */
export interface LayerConfig {
    id: LayerType;
    name: string;
    description: string;
    icon: string; // Lucide icon name
    color: string; // Primary color for this layer (CSS color)
    enabled: boolean;
    /** Polling interval in milliseconds */
    pollingInterval: number;
}

/**
 * Default layer configurations
 */
export const DEFAULT_LAYERS: LayerConfig[] = [
    {
        id: "aircraft",
        name: "Aircraft",
        description: "Live ADS-B flight tracking via OpenSky Network",
        icon: "Plane",
        color: "#00ff88",
        enabled: true,
        pollingInterval: 15_000,
    },
    {
        id: "vessel",
        name: "Vessels",
        description: "Maritime vessel tracking via AIS data",
        icon: "Ship",
        color: "#00aaff",
        enabled: true,
        pollingInterval: 60_000,
    },
    {
        id: "satellite",
        name: "Satellites",
        description: "Orbital tracking via CelesTrak TLE data",
        icon: "Satellite",
        color: "#aa88ff",
        enabled: true,
        pollingInterval: 300_000,
    },
    {
        id: "conflict",
        name: "Conflicts",
        description: "Armed conflict events via ACLED",
        icon: "AlertTriangle",
        color: "#ff4444",
        enabled: true,
        pollingInterval: 600_000,
    },
    {
        id: "gps-jamming",
        name: "GPS Jamming",
        description: "GPS interference zones via GPSJam.org",
        icon: "Radio",
        color: "#ffaa00",
        enabled: true,
        pollingInterval: 600_000,
    },
    {
        id: "social",
        name: "Social / News",
        description: "Social media posts and government announcements",
        icon: "Newspaper",
        color: "#ff6600",
        enabled: true,
        pollingInterval: 120_000,
    },
];
