/**
 * GPS Jamming zone data types
 * Based on GPSJam.org data format
 */

import type { Severity } from "./geo-event";

/**
 * GPS interference type
 */
export type InterferenceType =
    | "jamming"
    | "spoofing"
    | "interference"
    | "unknown";

/**
 * GPS jamming zone data
 */
export interface GPSJammingZone {
    /** Unique zone identifier */
    id: string;
    /** Zone name / region */
    name: string;
    /** Description of the jamming activity */
    description: string;
    /** Center longitude */
    longitude: number;
    /** Center latitude */
    latitude: number;
    /** Radius of affected area in kilometers */
    radiusKm: number;
    /** Interference type */
    interferenceType: InterferenceType;
    /** Severity level */
    severity: Severity;
    /** Confidence score (0-1) based on number of reports */
    confidence: number;
    /** Number of ADS-B reports indicating interference */
    reportCount: number;
    /** Affected aircraft count */
    affectedAircraftCount: number;
    /** First detected (ISO 8601) */
    firstDetected: string;
    /** Last detected (ISO 8601) */
    lastDetected: string;
    /** Whether the zone is currently active */
    isActive: boolean;
    /** Region/area name (e.g., "Eastern Mediterranean", "Baltic Sea") */
    region: string;
    /** Country most associated with the zone (if determinable) */
    country: string | null;
}

/**
 * GPS Jamming API response
 */
export interface GPSJammingResponse {
    /** Array of jamming zones */
    zones: GPSJammingZone[];
    /** Response timestamp */
    timestamp: string;
    /** Total active zones */
    activeCount: number;
}

/**
 * Known GPS jamming hotspots with approximate coordinates
 * These are well-documented interference zones from open source intelligence
 */
export const KNOWN_JAMMING_HOTSPOTS: Omit<GPSJammingZone, "id" | "firstDetected" | "lastDetected" | "reportCount" | "affectedAircraftCount" | "confidence" | "isActive">[] = [
    {
        name: "Eastern Mediterranean",
        description: "Persistent GPS interference affecting flights near Syria/Lebanon border. Likely military electronic warfare.",
        longitude: 35.5,
        latitude: 34.0,
        radiusKm: 300,
        interferenceType: "spoofing",
        severity: "high",
        region: "Middle East",
        country: null,
    },
    {
        name: "Kaliningrad Oblast",
        description: "GPS jamming detected around Russian exclave. Affects Baltic Sea maritime and air traffic.",
        longitude: 20.5,
        latitude: 54.7,
        radiusKm: 200,
        interferenceType: "jamming",
        severity: "high",
        region: "Baltic Sea",
        country: "Russia",
    },
    {
        name: "Black Sea - Crimea",
        description: "GPS spoofing and jamming around Crimean peninsula. Affects commercial shipping and aviation.",
        longitude: 34.0,
        latitude: 44.5,
        radiusKm: 250,
        interferenceType: "spoofing",
        severity: "high",
        region: "Black Sea",
        country: null,
    },
    {
        name: "Strait of Hormuz",
        description: "Intermittent GPS interference in the Strait of Hormuz. Affects tanker navigation.",
        longitude: 56.3,
        latitude: 26.5,
        radiusKm: 150,
        interferenceType: "jamming",
        severity: "medium",
        region: "Persian Gulf",
        country: "Iran",
    },
    {
        name: "Northern Norway - Finland Border",
        description: "GPS interference near Russian border. Affects civilian aviation in Arctic region.",
        longitude: 28.0,
        latitude: 69.5,
        radiusKm: 150,
        interferenceType: "jamming",
        severity: "medium",
        region: "Arctic",
        country: "Russia",
    },
    {
        name: "Red Sea - Yemen Coast",
        description: "GPS interference in southern Red Sea. Associated with Houthi military activity.",
        longitude: 42.5,
        latitude: 14.0,
        radiusKm: 200,
        interferenceType: "jamming",
        severity: "high",
        region: "Red Sea",
        country: "Yemen",
    },
    {
        name: "South China Sea - Spratly Islands",
        description: "GPS interference reported around disputed Spratly Islands area.",
        longitude: 114.0,
        latitude: 10.0,
        radiusKm: 200,
        interferenceType: "spoofing",
        severity: "medium",
        region: "South China Sea",
        country: "China",
    },
    {
        name: "Ukraine Conflict Zone",
        description: "Widespread GPS jamming and spoofing across the Ukraine conflict front lines.",
        longitude: 36.0,
        latitude: 48.5,
        radiusKm: 400,
        interferenceType: "jamming",
        severity: "critical",
        region: "Eastern Europe",
        country: null,
    },
];

/**
 * Get display color for interference severity
 */
export function getJammingSeverityColor(severity: Severity): string {
    switch (severity) {
        case "critical": return "#ff0000";
        case "high": return "#ff4400";
        case "medium": return "#ffaa00";
        case "low": return "#ffcc44";
        case "info": return "#888888";
    }
}

/**
 * Get display label for interference type
 */
export function getInterferenceTypeLabel(type: InterferenceType): string {
    switch (type) {
        case "jamming": return "GPS Jamming";
        case "spoofing": return "GPS Spoofing";
        case "interference": return "GPS Interference";
        default: return "Unknown Interference";
    }
}
