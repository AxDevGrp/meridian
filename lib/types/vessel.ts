/**
 * Maritime vessel data types
 * Based on AIS (Automatic Identification System) data format
 */

/**
 * Vessel navigation status codes (ITU-R M.1371-5)
 */
export type NavigationStatus =
    | "under_way_using_engine"
    | "at_anchor"
    | "not_under_command"
    | "restricted_manoeuvrability"
    | "constrained_by_draught"
    | "moored"
    | "aground"
    | "engaged_in_fishing"
    | "under_way_sailing"
    | "reserved"
    | "unknown";

/**
 * Vessel type categories
 */
export type VesselType =
    | "cargo"
    | "tanker"
    | "passenger"
    | "fishing"
    | "military"
    | "sailing"
    | "pleasure_craft"
    | "tug"
    | "pilot_vessel"
    | "search_rescue"
    | "other"
    | "unknown";

/**
 * Maritime vessel data from AIS tracking
 */
export interface Vessel {
    /** Maritime Mobile Service Identity (9-digit number) */
    mmsi: string;
    /** Vessel name */
    name: string;
    /** IMO number (if available) */
    imo: string | null;
    /** Callsign */
    callsign: string | null;
    /** Vessel type category */
    vesselType: VesselType;
    /** Flag state / country */
    flag: string | null;
    /** WGS-84 longitude in decimal degrees */
    longitude: number;
    /** WGS-84 latitude in decimal degrees */
    latitude: number;
    /** Course over ground in degrees (0-360) */
    course: number | null;
    /** Speed over ground in knots */
    speed: number | null;
    /** True heading in degrees (0-360) */
    heading: number | null;
    /** Navigation status */
    navigationStatus: NavigationStatus;
    /** Destination port (if reported via AIS) */
    destination: string | null;
    /** Estimated time of arrival (ISO 8601) */
    eta: string | null;
    /** Draught in meters */
    draught: number | null;
    /** Length of vessel in meters */
    length: number | null;
    /** Width of vessel in meters */
    width: number | null;
    /** Unix timestamp of last AIS message */
    lastUpdate: number;
}

/**
 * AIS API response structure
 */
export interface AISResponse {
    /** Array of vessel data */
    vessels: Vessel[];
    /** Response timestamp */
    timestamp: number;
    /** Total count */
    count: number;
}

/**
 * Get display color for vessel type
 */
export function getVesselColor(type: VesselType): string {
    switch (type) {
        case "cargo": return "#00aaff";
        case "tanker": return "#ff6600";
        case "passenger": return "#00cc66";
        case "fishing": return "#66ccff";
        case "military": return "#ff0066";
        case "sailing": return "#88ddff";
        case "pleasure_craft": return "#88ddff";
        case "tug": return "#cccc00";
        case "pilot_vessel": return "#ffcc00";
        case "search_rescue": return "#ff3300";
        default: return "#0088cc";
    }
}

/**
 * Get display label for vessel type
 */
export function getVesselTypeLabel(type: VesselType): string {
    switch (type) {
        case "cargo": return "Cargo";
        case "tanker": return "Tanker";
        case "passenger": return "Passenger";
        case "fishing": return "Fishing";
        case "military": return "Military";
        case "sailing": return "Sailing";
        case "pleasure_craft": return "Pleasure Craft";
        case "tug": return "Tug";
        case "pilot_vessel": return "Pilot Vessel";
        case "search_rescue": return "Search & Rescue";
        case "other": return "Other";
        default: return "Unknown";
    }
}

/**
 * Get display label for navigation status
 */
export function getNavigationStatusLabel(status: NavigationStatus): string {
    switch (status) {
        case "under_way_using_engine": return "Under Way (Engine)";
        case "at_anchor": return "At Anchor";
        case "not_under_command": return "Not Under Command";
        case "restricted_manoeuvrability": return "Restricted Manoeuvrability";
        case "constrained_by_draught": return "Constrained by Draught";
        case "moored": return "Moored";
        case "aground": return "Aground";
        case "engaged_in_fishing": return "Fishing";
        case "under_way_sailing": return "Under Way (Sailing)";
        case "reserved": return "Reserved";
        default: return "Unknown";
    }
}
