/**
 * Satellite tracking data types
 * Based on CelesTrak TLE (Two-Line Element) data format
 */

/**
 * Satellite orbit type categories
 */
export type OrbitType =
    | "leo"    // Low Earth Orbit (< 2000 km)
    | "meo"    // Medium Earth Orbit (2000-35786 km)
    | "geo"    // Geostationary Orbit (~35786 km)
    | "heo"    // Highly Elliptical Orbit
    | "sso"    // Sun-Synchronous Orbit
    | "unknown";

/**
 * Satellite purpose categories
 */
export type SatellitePurpose =
    | "communications"
    | "navigation"
    | "earth_observation"
    | "weather"
    | "scientific"
    | "military"
    | "space_station"
    | "debris"
    | "starlink"
    | "other"
    | "unknown";

/**
 * Two-Line Element set data
 */
export interface TLEData {
    /** Line 1 of TLE */
    line1: string;
    /** Line 2 of TLE */
    line2: string;
}

/**
 * Satellite orbital elements (derived from TLE)
 */
export interface OrbitalElements {
    /** Inclination in degrees */
    inclination: number;
    /** Right ascension of ascending node in degrees */
    raan: number;
    /** Eccentricity (0-1) */
    eccentricity: number;
    /** Argument of perigee in degrees */
    argOfPerigee: number;
    /** Mean anomaly in degrees */
    meanAnomaly: number;
    /** Mean motion (revolutions per day) */
    meanMotion: number;
    /** Epoch of the TLE (ISO 8601) */
    epoch: string;
}

/**
 * Satellite position at a given time
 */
export interface SatellitePosition {
    /** WGS-84 longitude in decimal degrees */
    longitude: number;
    /** WGS-84 latitude in decimal degrees */
    latitude: number;
    /** Altitude above Earth's surface in kilometers */
    altitude: number;
    /** Velocity in km/s */
    velocity: number;
}

/**
 * Complete satellite data
 */
export interface Satellite {
    /** NORAD Catalog Number */
    noradId: string;
    /** Satellite name */
    name: string;
    /** International designator */
    intlDesignator: string | null;
    /** TLE data */
    tle: TLEData;
    /** Parsed orbital elements */
    orbitalElements: OrbitalElements;
    /** Current computed position */
    position: SatellitePosition;
    /** Orbit type classification */
    orbitType: OrbitType;
    /** Satellite purpose */
    purpose: SatellitePurpose;
    /** Launch date (ISO 8601, if known) */
    launchDate: string | null;
    /** Operating country/organization */
    country: string | null;
    /** Last TLE update timestamp */
    lastUpdate: string;
}

/**
 * CelesTrak GP (General Perturbations) data format
 * This is the JSON format from CelesTrak's API
 */
export interface CelesTrakGPData {
    OBJECT_NAME: string;
    OBJECT_ID: string;
    EPOCH: string;
    MEAN_MOTION: number;
    ECCENTRICITY: number;
    INCLINATION: number;
    RA_OF_ASC_NODE: number;
    ARG_OF_PERICENTER: number;
    MEAN_ANOMALY: number;
    EPHEMERIS_TYPE: number;
    CLASSIFICATION_TYPE: string;
    NORAD_CAT_ID: number;
    ELEMENT_SET_NO: number;
    REV_AT_EPOCH: number;
    BSTAR: number;
    MEAN_MOTION_DOT: number;
    MEAN_MOTION_DDOT: number;
    TLE_LINE0?: string;
    TLE_LINE1?: string;
    TLE_LINE2?: string;
}

/**
 * Satellites API response structure
 */
export interface SatelliteResponse {
    /** Array of satellite data */
    satellites: Satellite[];
    /** Response timestamp */
    timestamp: string;
    /** Total count */
    count: number;
    /** TLE epoch used */
    tleEpoch: string;
}

/**
 * Classify orbit type based on altitude and orbital elements
 */
export function classifyOrbit(altitude: number, inclination: number, eccentricity: number): OrbitType {
    if (eccentricity > 0.25) return "heo";
    if (altitude < 2000) {
        if (inclination > 95 && inclination < 105) return "sso";
        return "leo";
    }
    if (altitude < 35786) return "meo";
    if (altitude >= 35700 && altitude <= 35900 && eccentricity < 0.01) return "geo";
    return "unknown";
}

/**
 * Classify satellite purpose based on name patterns
 */
export function classifySatellitePurpose(name: string): SatellitePurpose {
    const upperName = name.toUpperCase();

    if (upperName.includes("STARLINK")) return "starlink";
    if (upperName.includes("ISS") || upperName.includes("TIANGONG")) return "space_station";
    if (upperName.includes("GPS") || upperName.includes("NAVSTAR") || upperName.includes("GLONASS") || upperName.includes("GALILEO") || upperName.includes("BEIDOU")) return "navigation";
    if (upperName.includes("GOES") || upperName.includes("METEOSAT") || upperName.includes("NOAA") || upperName.includes("METEOR")) return "weather";
    if (upperName.includes("IRIDIUM") || upperName.includes("INTELSAT") || upperName.includes("SES") || upperName.includes("TELESAT")) return "communications";
    if (upperName.includes("LANDSAT") || upperName.includes("SENTINEL") || upperName.includes("WORLDVIEW")) return "earth_observation";
    if (upperName.includes("COSMOS") || upperName.includes("USA ") || upperName.includes("NROL")) return "military";
    if (upperName.includes("DEB") || upperName.includes("R/B")) return "debris";

    return "unknown";
}

/**
 * Get display color for satellite purpose
 */
export function getSatelliteColor(purpose: SatellitePurpose): string {
    switch (purpose) {
        case "communications": return "#aa88ff";
        case "navigation": return "#00ccff";
        case "earth_observation": return "#44ff88";
        case "weather": return "#88ccff";
        case "scientific": return "#ffcc44";
        case "military": return "#ff4466";
        case "space_station": return "#ffffff";
        case "debris": return "#666666";
        case "starlink": return "#ccccff";
        default: return "#8866cc";
    }
}

/**
 * Get orbit type display label
 */
export function getOrbitTypeLabel(type: OrbitType): string {
    switch (type) {
        case "leo": return "Low Earth Orbit";
        case "meo": return "Medium Earth Orbit";
        case "geo": return "Geostationary";
        case "heo": return "Highly Elliptical";
        case "sso": return "Sun-Synchronous";
        default: return "Unknown";
    }
}
