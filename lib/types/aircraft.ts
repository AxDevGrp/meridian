/**
 * Aircraft data from OpenSky Network API
 * Based on OpenSky Network API specification
 */
export interface Aircraft {
    /** Unique ICAO 24-bit address of the transponder (hex string) */
    icao24: string;
    /** Callsign of the vehicle (8 chars, can be null if not available) */
    callsign: string | null;
    /** Country name inferred from the ICAO 24-bit address */
    originCountry: string;
    /** WGS-84 longitude in decimal degrees (can be null) */
    longitude: number | null;
    /** WGS-84 latitude in decimal degrees (can be null) */
    latitude: number | null;
    /** Barometric altitude in meters (can be null) */
    baroAltitude: number | null;
    /** Velocity over ground in m/s (can be null) */
    velocity: number | null;
    /** True track in decimal degrees clockwise from north (can be null) */
    heading: number | null;
    /** Vertical rate in m/s (can be null, positive = climbing) */
    verticalRate: number | null;
    /** True if aircraft is on ground */
    onGround: boolean;
    /** Unix timestamp of the last message received (can be null) */
    lastContact: number | null;
    /** Unix timestamp of the last position update */
    timePosition: number | null;
    /** Geometric altitude in meters (can be null) */
    geoAltitude: number | null;
    /** Squawk code (4 octal digits, can be null) */
    squawk: string | null;
    /** True if SPI (Special Purpose Identification) is set */
    spi: boolean;
    /** Position source: 0 = ADS-B, 1 = ASTERIX, 2 = MLAT, 3 = FLARM */
    positionSource: number;
    /** Category of the aircraft (0-15, can be null) */
    category: number | null;
}

/**
 * OpenSky Network API response structure
 * The states array contains arrays of values, not objects
 */
export interface OpenSkyResponse {
    /** Unix timestamp of the response */
    time: number;
    /** Array of aircraft state arrays */
    states: AircraftStateArray[];
}

/**
 * Aircraft state as returned by OpenSky API (array format)
 * Index mapping based on OpenSky Network API documentation
 */
export type AircraftStateArray = [
    string,           // 0: icao24
    string | null,    // 1: callsign
    string,           // 2: originCountry
    number | null,    // 3: timePosition
    number | null,    // 4: lastContact
    number | null,    // 5: longitude
    number | null,    // 6: latitude
    number | null,    // 7: baroAltitude
    boolean,          // 8: onGround
    number | null,    // 9: velocity
    number | null,    // 10: heading
    number | null,    // 11: verticalRate
    number | null,    // 12: sensors (array, usually null)
    number | null,    // 13: geoAltitude
    string | null,    // 14: squawk
    boolean,          // 15: spi
    number,           // 16: positionSource
    number | null,    // 17: category
];

/**
 * Bounding box for geographic queries
 */
export interface BoundingBox {
    /** Minimum latitude (south boundary) */
    lamin: number;
    /** Minimum longitude (west boundary) */
    lomin: number;
    /** Maximum latitude (north boundary) */
    lamax: number;
    /** Maximum longitude (east boundary) */
    lomax: number;
}

/**
 * Application state for aircraft data
 */
export interface AircraftState {
    /** Current aircraft positions */
    aircraft: Aircraft[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Last successful update timestamp */
    lastUpdated: Date | null;
    /** Whether polling is active */
    isPolling: boolean;
}

/**
 * Transform OpenSky state array to Aircraft object
 */
export function transformAircraftState(state: AircraftStateArray): Aircraft {
    return {
        icao24: state[0],
        callsign: state[1]?.trim() || null,
        originCountry: state[2],
        timePosition: state[3],
        lastContact: state[4],
        longitude: state[5],
        latitude: state[6],
        baroAltitude: state[7],
        onGround: state[8],
        velocity: state[9],
        heading: state[10],
        verticalRate: state[11],
        geoAltitude: state[13],
        squawk: state[14],
        spi: state[15],
        positionSource: state[16],
        category: state[17],
    };
}

/**
 * Transform OpenSky response to Aircraft array
 */
export function transformOpenSkyResponse(response: OpenSkyResponse): Aircraft[] {
    if (!response.states || response.states.length === 0) {
        return [];
    }
    return response.states.map(transformAircraftState);
}