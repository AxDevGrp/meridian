/**
 * Conflict event data types
 * Based on ACLED (Armed Conflict Location & Event Data) format
 */

/**
 * ACLED event types
 */
export type ConflictEventType =
    | "battles"
    | "violence_against_civilians"
    | "explosions_remote_violence"
    | "riots"
    | "protests"
    | "strategic_developments";

/**
 * ACLED sub-event types
 */
export type ConflictSubEventType =
    | "armed_clash"
    | "government_regains_territory"
    | "non_state_actor_overtakes_territory"
    | "attack"
    | "sexual_violence"
    | "abduction_forced_disappearance"
    | "chemical_weapon"
    | "air_drone_strike"
    | "suicide_bomb"
    | "shelling_artillery"
    | "remote_explosive"
    | "grenade"
    | "violent_demonstration"
    | "mob_violence"
    | "peaceful_protest"
    | "protest_with_intervention"
    | "excessive_force_against_protesters"
    | "headquarters_or_base_established"
    | "agreement"
    | "arrests"
    | "change_to_group_activity"
    | "disrupted_weapons_use"
    | "looting_property_destruction"
    | "non_violent_transfer_of_territory"
    | "other";

/**
 * Conflict event fatality estimate
 */
export interface FatalityEstimate {
    /** Reported fatalities */
    reported: number;
    /** Whether the count is an estimate */
    isEstimate: boolean;
}

/**
 * Armed conflict event from ACLED
 */
export interface ConflictEvent {
    /** ACLED event ID */
    eventId: string;
    /** Event date (ISO 8601) */
    eventDate: string;
    /** Event type */
    eventType: ConflictEventType;
    /** Sub-event type */
    subEventType: ConflictSubEventType;
    /** WGS-84 longitude */
    longitude: number;
    /** WGS-84 latitude */
    latitude: number;
    /** Country name */
    country: string;
    /** ISO3 country code */
    iso3: string;
    /** Admin region level 1 (province/state) */
    admin1: string | null;
    /** Admin region level 2 (district) */
    admin2: string | null;
    /** Location name */
    location: string;
    /** Actor 1 name */
    actor1: string;
    /** Actor 2 name (if applicable) */
    actor2: string | null;
    /** Associated actors */
    associatedActors: string[];
    /** Fatality estimate */
    fatalities: FatalityEstimate;
    /** Notes / description */
    notes: string;
    /** Data source within ACLED */
    source: string;
    /** Source scale (reliability) */
    sourceScale: string | null;
    /** Geo-precision level (1=exact, 2=nearby, 3=region) */
    geoPrecision: 1 | 2 | 3;
    /** Time precision (1=exact, 2=week, 3=month) */
    timePrecision: 1 | 2 | 3;
    /** Interaction code */
    interaction: number;
    /** Tags (if any) */
    tags: string[];
}

/**
 * ACLED API response structure
 */
export interface ACLEDResponse {
    /** Whether the request was successful */
    success: boolean;
    /** Array of conflict events */
    data: ConflictEvent[];
    /** Total count */
    count: number;
    /** Response timestamp */
    timestamp: string;
}

/**
 * Raw ACLED API data format (before transformation)
 */
export interface ACLEDRawEvent {
    event_id_cnty: string;
    event_date: string;
    year: string;
    time_precision: string;
    event_type: string;
    sub_event_type: string;
    actor1: string;
    assoc_actor_1: string;
    inter1: string;
    actor2: string;
    assoc_actor_2: string;
    inter2: string;
    interaction: string;
    region: string;
    country: string;
    admin1: string;
    admin2: string;
    admin3: string;
    location: string;
    latitude: string;
    longitude: string;
    geo_precision: string;
    source: string;
    source_scale: string;
    notes: string;
    fatalities: string;
    iso: string;
    iso3: string;
    tags: string;
    timestamp: string;
}

/**
 * Get severity level for a conflict event
 */
export function getConflictSeverity(event: ConflictEvent): "critical" | "high" | "medium" | "low" | "info" {
    // Critical: high fatality events
    if (event.fatalities.reported >= 50) return "critical";

    // High: battles and violence with fatalities
    if (event.fatalities.reported >= 10) return "high";

    // Medium: events with some fatalities or violence
    if (event.eventType === "battles" || event.eventType === "explosions_remote_violence") {
        return event.fatalities.reported > 0 ? "high" : "medium";
    }

    if (event.eventType === "violence_against_civilians") return "medium";

    // Low: riots
    if (event.eventType === "riots") return "low";

    // Info: protests, strategic developments
    return "info";
}

/**
 * Get display color for conflict event type
 */
export function getConflictColor(eventType: ConflictEventType): string {
    switch (eventType) {
        case "battles": return "#ff2222";
        case "violence_against_civilians": return "#ff4466";
        case "explosions_remote_violence": return "#ff6600";
        case "riots": return "#ffaa00";
        case "protests": return "#ffcc44";
        case "strategic_developments": return "#888888";
    }
}

/**
 * Get display label for conflict event type
 */
export function getConflictTypeLabel(eventType: ConflictEventType): string {
    switch (eventType) {
        case "battles": return "Battles";
        case "violence_against_civilians": return "Violence Against Civilians";
        case "explosions_remote_violence": return "Explosions / Remote Violence";
        case "riots": return "Riots";
        case "protests": return "Protests";
        case "strategic_developments": return "Strategic Developments";
    }
}

/**
 * Transform raw ACLED event to normalized ConflictEvent
 */
export function transformACLEDEvent(raw: ACLEDRawEvent): ConflictEvent {
    return {
        eventId: raw.event_id_cnty,
        eventDate: raw.event_date,
        eventType: normalizeEventType(raw.event_type),
        subEventType: normalizeSubEventType(raw.sub_event_type),
        longitude: parseFloat(raw.longitude),
        latitude: parseFloat(raw.latitude),
        country: raw.country,
        iso3: raw.iso3,
        admin1: raw.admin1 || null,
        admin2: raw.admin2 || null,
        location: raw.location,
        actor1: raw.actor1,
        actor2: raw.actor2 || null,
        associatedActors: [raw.assoc_actor_1, raw.assoc_actor_2].filter(Boolean),
        fatalities: {
            reported: parseInt(raw.fatalities) || 0,
            isEstimate: false,
        },
        notes: raw.notes,
        source: raw.source,
        sourceScale: raw.source_scale || null,
        geoPrecision: parseInt(raw.geo_precision) as 1 | 2 | 3,
        timePrecision: parseInt(raw.time_precision) as 1 | 2 | 3,
        interaction: parseInt(raw.interaction) || 0,
        tags: raw.tags ? raw.tags.split(";").map(t => t.trim()).filter(Boolean) : [],
    };
}

/**
 * Normalize ACLED event type string to our enum
 */
function normalizeEventType(type: string): ConflictEventType {
    const normalized = type.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_");
    const mapping: Record<string, ConflictEventType> = {
        battles: "battles",
        violence_against_civilians: "violence_against_civilians",
        explosions_remote_violence: "explosions_remote_violence",
        "explosions/remote_violence": "explosions_remote_violence",
        riots: "riots",
        protests: "protests",
        strategic_developments: "strategic_developments",
    };
    return mapping[normalized] || "strategic_developments";
}

/**
 * Normalize ACLED sub-event type string to our enum
 */
function normalizeSubEventType(type: string): ConflictSubEventType {
    const normalized = type.toLowerCase().replace(/\s+/g, "_").replace(/[/-]/g, "_");
    const mapping: Record<string, ConflictSubEventType> = {
        armed_clash: "armed_clash",
        government_regains_territory: "government_regains_territory",
        non_state_actor_overtakes_territory: "non_state_actor_overtakes_territory",
        attack: "attack",
        sexual_violence: "sexual_violence",
        "abduction_forced_disappearance": "abduction_forced_disappearance",
        chemical_weapon: "chemical_weapon",
        "air_drone_strike": "air_drone_strike",
        suicide_bomb: "suicide_bomb",
        "shelling_artillery_missile_attack": "shelling_artillery",
        remote_explosive_ied: "remote_explosive",
        grenade: "grenade",
        violent_demonstration: "violent_demonstration",
        mob_violence: "mob_violence",
        peaceful_protest: "peaceful_protest",
        protest_with_intervention: "protest_with_intervention",
        excessive_force_against_protesters: "excessive_force_against_protesters",
    };
    return mapping[normalized] || "other";
}
