/**
 * Pattern Recognition Engine.
 * Detects cross-layer patterns: temporal correlations, spatial clusters,
 * sequence detections, and entity co-occurrences across all data layers.
 */

import type {
    Pattern,
    TemporalCorrelation,
    SpatialCluster,
    SequenceDetection,
    EntityCooccurrence,
} from "@/lib/types/analytics";
import type { AnomalyDataSnapshot } from "./anomaly-engine";
import { haversineKm } from "@/lib/correlation-engine";
import { MONITORED_REGIONS } from "./regions";

// ============================================
// Public API
// ============================================

/**
 * Detect all patterns from the current data snapshot.
 * Returns an array of Pattern objects across all pattern types.
 */
export function detectPatterns(data: AnomalyDataSnapshot): Pattern[] {
    const patterns: Pattern[] = [];

    patterns.push(...detectTemporalCorrelations(data));
    patterns.push(...detectSpatialClusters(data));
    patterns.push(...detectSequences(data));
    patterns.push(...detectEntityCooccurrences(data));

    return patterns;
}

// ============================================
// Helpers
// ============================================

let _idCounter = 0;

function patternId(prefix: string): string {
    _idCounter += 1;
    return `${prefix}-${Date.now()}-${_idCounter}`;
}

/**
 * Total number of data layers we track.
 */
const TOTAL_LAYERS = 6; // conflicts, gps-jamming, vessels, aircraft, social, market

// ============================================
// Temporal Correlations
// ============================================

/**
 * Look for events from different layers that co-exist in the same region
 * or happened close in time (within 60-minute windows).
 */
function detectTemporalCorrelations(
    data: AnomalyDataSnapshot,
): TemporalCorrelation[] {
    const results: TemporalCorrelation[] = [];
    const now = new Date();

    // Collect timestamped events from each layer
    interface TimedEvent {
        layer: string;
        id: string;
        title: string;
        timestamp: string;
        ts: number;
    }

    const events: TimedEvent[] = [];

    for (const c of data.conflicts) {
        events.push({
            layer: "conflicts",
            id: c.eventId,
            title: `${c.eventType} in ${c.location}`,
            timestamp: c.eventDate,
            ts: new Date(c.eventDate).getTime(),
        });
    }

    for (const z of data.gpsJamming) {
        events.push({
            layer: "gps-jamming",
            id: z.id,
            title: `${z.interferenceType} in ${z.region}`,
            timestamp: z.lastDetected,
            ts: new Date(z.lastDetected).getTime(),
        });
    }

    for (const v of data.vessels) {
        const ts = v.lastUpdate ? v.lastUpdate * 1000 : now.getTime();
        events.push({
            layer: "vessels",
            id: v.mmsi,
            title: `${v.name || "Unknown vessel"} (${v.vesselType})`,
            timestamp: new Date(ts).toISOString(),
            ts,
        });
    }

    for (const ac of data.aircraft) {
        const ts = ac.lastContact ? ac.lastContact * 1000 : now.getTime();
        events.push({
            layer: "aircraft",
            id: ac.icao24,
            title: `Aircraft ${ac.callsign?.trim() || ac.icao24}`,
            timestamp: new Date(ts).toISOString(),
            ts,
        });
    }

    for (const post of data.socialPosts) {
        events.push({
            layer: "social",
            id: post.id,
            title: `${post.platform}: ${post.content.slice(0, 40)}...`,
            timestamp: post.postedAt,
            ts: new Date(post.postedAt).getTime(),
        });
    }

    for (const inst of data.marketInstruments) {
        if (inst.lastUpdated) {
            events.push({
                layer: "market",
                id: inst.symbol,
                title: `${inst.name} (${inst.changePercent != null ? (inst.changePercent > 0 ? "+" : "") + inst.changePercent.toFixed(2) + "%" : "N/A"})`,
                timestamp: inst.lastUpdated,
                ts: new Date(inst.lastUpdated).getTime(),
            });
        }
    }

    if (events.length === 0) return results;

    // Sort by timestamp
    events.sort((a, b) => a.ts - b.ts);

    // Sliding 60-minute windows
    const windowMs = 60 * 60 * 1000;
    let windowStart = 0;

    for (let windowEnd = 0; windowEnd < events.length; windowEnd++) {
        // Move window start forward
        while (
            windowStart < windowEnd &&
            events[windowEnd].ts - events[windowStart].ts > windowMs
        ) {
            windowStart++;
        }

        // Check if window has events from 3+ different layers
        if (windowEnd - windowStart + 1 >= 3) {
            const windowEvents = events.slice(windowStart, windowEnd + 1);
            const layerSet = new Set(windowEvents.map((e) => e.layer));

            if (layerSet.size >= 3) {
                // Deduplicate: pick one event per layer
                const layerReps = new Map<string, TimedEvent>();
                for (const e of windowEvents) {
                    if (!layerReps.has(e.layer)) layerReps.set(e.layer, e);
                }

                const involvedLayers = Array.from(layerSet);
                const confidence = involvedLayers.length / TOTAL_LAYERS;
                const correlationStrength = Math.min(
                    1.0,
                    involvedLayers.length / (TOTAL_LAYERS - 1),
                );

                results.push({
                    id: patternId("tc"),
                    kind: "temporal_correlation",
                    title: `Cross-layer temporal correlation (${involvedLayers.length} layers)`,
                    description: `Events from ${involvedLayers.join(", ")} layers occurred within a 60-minute window, suggesting correlated activity.`,
                    confidence: Math.round(confidence * 100) / 100,
                    detectedAt: now.toISOString(),
                    involvedLayers,
                    metadata: {
                        events: Array.from(layerReps.values()).map((e) => ({
                            layer: e.layer,
                            id: e.id,
                            title: e.title,
                            timestamp: e.timestamp,
                        })),
                        timeWindowMinutes: 60,
                        correlationStrength,
                    },
                });

                // Skip ahead to avoid duplicate detections for overlapping windows
                windowStart = windowEnd + 1;
            }
        }
    }

    // Also check for region-based co-existence (complementary to time-based)
    for (const region of MONITORED_REGIONS) {
        const regionEvents: TimedEvent[] = [];

        // Gather events that are geographically in this region
        for (const c of data.conflicts) {
            if (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    c.latitude,
                    c.longitude,
                ) <= region.radiusKm
            ) {
                regionEvents.push({
                    layer: "conflicts",
                    id: c.eventId,
                    title: `${c.eventType} in ${c.location}`,
                    timestamp: c.eventDate,
                    ts: new Date(c.eventDate).getTime(),
                });
            }
        }

        for (const z of data.gpsJamming) {
            if (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    z.latitude,
                    z.longitude,
                ) <= region.radiusKm
            ) {
                regionEvents.push({
                    layer: "gps-jamming",
                    id: z.id,
                    title: `${z.interferenceType} in ${z.region}`,
                    timestamp: z.lastDetected,
                    ts: new Date(z.lastDetected).getTime(),
                });
            }
        }

        for (const v of data.vessels) {
            if (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    v.latitude,
                    v.longitude,
                ) <= region.radiusKm
            ) {
                const vTs = v.lastUpdate ? v.lastUpdate * 1000 : now.getTime();
                regionEvents.push({
                    layer: "vessels",
                    id: v.mmsi,
                    title: v.name || "Unknown vessel",
                    timestamp: new Date(vTs).toISOString(),
                    ts: vTs,
                });
            }
        }

        for (const ac of data.aircraft) {
            if (ac.latitude == null || ac.longitude == null) continue;
            if (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    ac.latitude,
                    ac.longitude,
                ) <= region.radiusKm
            ) {
                const ts = ac.lastContact ? ac.lastContact * 1000 : now.getTime();
                regionEvents.push({
                    layer: "aircraft",
                    id: ac.icao24,
                    title: ac.callsign?.trim() || ac.icao24,
                    timestamp: new Date(ts).toISOString(),
                    ts,
                });
            }
        }

        const layerSet = new Set(regionEvents.map((e) => e.layer));
        if (layerSet.size >= 3) {
            // Check we haven't already flagged this from temporal analysis
            const alreadyFlagged = results.some(
                (r) =>
                    r.description.includes(region.name) &&
                    r.kind === "temporal_correlation",
            );
            if (!alreadyFlagged) {
                const involvedLayers = Array.from(layerSet);
                const confidence = involvedLayers.length / TOTAL_LAYERS;

                const layerReps = new Map<string, TimedEvent>();
                for (const e of regionEvents) {
                    if (!layerReps.has(e.layer)) layerReps.set(e.layer, e);
                }

                results.push({
                    id: patternId("tc"),
                    kind: "temporal_correlation",
                    title: `Multi-layer activity in ${region.name}`,
                    description: `${involvedLayers.length} data layers (${involvedLayers.join(", ")}) have concurrent activity in the ${region.name} region.`,
                    confidence: Math.round(confidence * 100) / 100,
                    detectedAt: now.toISOString(),
                    involvedLayers,
                    metadata: {
                        events: Array.from(layerReps.values()).map((e) => ({
                            layer: e.layer,
                            id: e.id,
                            title: e.title,
                            timestamp: e.timestamp,
                        })),
                        timeWindowMinutes: 60,
                        correlationStrength: confidence,
                    },
                });
            }
        }
    }

    return results;
}

// ============================================
// Spatial Clusters
// ============================================

/**
 * Detect spatial clusters: regions with entities from 3+ different layers.
 */
function detectSpatialClusters(data: AnomalyDataSnapshot): SpatialCluster[] {
    const results: SpatialCluster[] = [];
    const now = new Date().toISOString();

    for (const region of MONITORED_REGIONS) {
        const layerCounts: Record<string, number> = {};
        let totalEntities = 0;

        // Conflicts
        const conflictsInRegion = data.conflicts.filter(
            (c) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    c.latitude,
                    c.longitude,
                ) <= region.radiusKm,
        );
        if (conflictsInRegion.length > 0) {
            layerCounts["conflicts"] = conflictsInRegion.length;
            totalEntities += conflictsInRegion.length;
        }

        // GPS jamming
        const jammingInRegion = data.gpsJamming.filter(
            (z) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    z.latitude,
                    z.longitude,
                ) <= region.radiusKm,
        );
        if (jammingInRegion.length > 0) {
            layerCounts["gps-jamming"] = jammingInRegion.length;
            totalEntities += jammingInRegion.length;
        }

        // Vessels
        const vesselsInRegion = data.vessels.filter(
            (v) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    v.latitude,
                    v.longitude,
                ) <= region.radiusKm,
        );
        if (vesselsInRegion.length > 0) {
            layerCounts["vessels"] = vesselsInRegion.length;
            totalEntities += vesselsInRegion.length;
        }

        // Aircraft
        const aircraftInRegion = data.aircraft.filter((ac) => {
            if (ac.latitude == null || ac.longitude == null) return false;
            return (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    ac.latitude,
                    ac.longitude,
                ) <= region.radiusKm
            );
        });
        if (aircraftInRegion.length > 0) {
            layerCounts["aircraft"] = aircraftInRegion.length;
            totalEntities += aircraftInRegion.length;
        }

        const layerNames = Object.keys(layerCounts);
        if (layerNames.length >= 3) {
            // Area approximation in km² (circle)
            const areaKm2 = Math.PI * region.radiusKm * region.radiusKm;
            const density = totalEntities / areaKm2;
            const confidence =
                Math.round((layerNames.length / TOTAL_LAYERS) * 100) / 100;

            results.push({
                id: patternId("sc"),
                kind: "spatial_cluster",
                title: `Multi-layer cluster in ${region.name}`,
                description: `${totalEntities} entities from ${layerNames.length} layers (${layerNames.join(", ")}) detected within ${region.radiusKm}km of ${region.name}.`,
                confidence,
                detectedAt: now,
                involvedLayers: layerNames,
                metadata: {
                    center: region.center,
                    radiusKm: region.radiusKm,
                    entityCount: totalEntities,
                    layers: layerNames,
                    density: Math.round(density * 10000) / 10000,
                },
            });
        }
    }

    return results;
}

// ============================================
// Sequence Detection
// ============================================

interface SequenceTemplate {
    name: string;
    steps: { order: number; layer: string; description: string }[];
}

const SEQUENCE_TEMPLATES: SequenceTemplate[] = [
    {
        name: "Tension Escalation",
        steps: [
            {
                order: 1,
                layer: "social",
                description: "Negative sentiment surge detected",
            },
            {
                order: 2,
                layer: "conflicts",
                description: "Conflict activity increase",
            },
            {
                order: 3,
                layer: "market",
                description: "Market volatility reaction",
            },
        ],
    },
    {
        name: "Military Buildup",
        steps: [
            {
                order: 1,
                layer: "aircraft",
                description: "Increased aircraft activity",
            },
            {
                order: 2,
                layer: "vessels",
                description: "Vessel positioning / buildup",
            },
            {
                order: 3,
                layer: "gps-jamming",
                description: "GPS jamming activity detected",
            },
        ],
    },
    {
        name: "Economic Disruption",
        steps: [
            {
                order: 1,
                layer: "conflicts",
                description: "Conflict event triggers disruption",
            },
            {
                order: 2,
                layer: "vessels",
                description: "Vessel traffic disruption",
            },
            {
                order: 3,
                layer: "market",
                description: "Market impact observed",
            },
        ],
    },
];

/**
 * Detect known sequence patterns in the data.
 * If 2+ steps of a known template match, flag as detected sequence.
 */
function detectSequences(data: AnomalyDataSnapshot): SequenceDetection[] {
    const results: SequenceDetection[] = [];
    const now = new Date();

    // Check which layers have data present
    const activeLayers = new Set<string>();
    if (data.conflicts.length > 0) activeLayers.add("conflicts");
    if (data.gpsJamming.length > 0) activeLayers.add("gps-jamming");
    if (data.vessels.length > 0) activeLayers.add("vessels");
    if (data.aircraft.length > 0) activeLayers.add("aircraft");
    if (data.socialPosts.length > 0) activeLayers.add("social");
    if (data.marketInstruments.length > 0) activeLayers.add("market");

    for (const template of SEQUENCE_TEMPLATES) {
        const matchedSteps: {
            order: number;
            layer: string;
            description: string;
            timestamp: string;
        }[] = [];

        for (const step of template.steps) {
            if (activeLayers.has(step.layer)) {
                // Determine a representative timestamp for this layer
                let ts = now.toISOString();
                if (step.layer === "conflicts" && data.conflicts.length > 0) {
                    ts = data.conflicts[0].eventDate;
                } else if (
                    step.layer === "gps-jamming" &&
                    data.gpsJamming.length > 0
                ) {
                    ts = data.gpsJamming[0].lastDetected;
                } else if (step.layer === "vessels" && data.vessels.length > 0) {
                    ts = data.vessels[0].lastUpdate
                        ? new Date(data.vessels[0].lastUpdate * 1000).toISOString()
                        : now.toISOString();
                } else if (
                    step.layer === "aircraft" &&
                    data.aircraft.length > 0
                ) {
                    ts = data.aircraft[0].lastContact
                        ? new Date(
                            data.aircraft[0].lastContact * 1000,
                        ).toISOString()
                        : now.toISOString();
                } else if (
                    step.layer === "social" &&
                    data.socialPosts.length > 0
                ) {
                    ts = data.socialPosts[0].postedAt;
                } else if (
                    step.layer === "market" &&
                    data.marketInstruments.length > 0
                ) {
                    ts =
                        data.marketInstruments[0].lastUpdated ??
                        now.toISOString();
                }

                matchedSteps.push({
                    order: step.order,
                    layer: step.layer,
                    description: step.description,
                    timestamp: ts,
                });
            }
        }

        if (matchedSteps.length >= 2) {
            const totalSteps = template.steps.length;
            const confidence =
                Math.round((matchedSteps.length / totalSteps) * 100) / 100;
            const involvedLayers = matchedSteps.map((s) => s.layer);

            results.push({
                id: patternId("sd"),
                kind: "sequence_detection",
                title: `${template.name} pattern detected`,
                description: `${matchedSteps.length}/${totalSteps} steps of the "${template.name}" sequence matched: ${matchedSteps.map((s) => s.description).join(" → ")}.`,
                confidence,
                detectedAt: now.toISOString(),
                involvedLayers,
                metadata: {
                    steps: matchedSteps,
                    patternName: template.name,
                    recurrenceCount: 1,
                },
            });
        }
    }

    return results;
}

// ============================================
// Entity Co-occurrences
// ============================================

/**
 * Detect entity co-occurrences: entities appearing near multiple event types
 * or in multiple monitored regions.
 */
function detectEntityCooccurrences(
    data: AnomalyDataSnapshot,
): EntityCooccurrence[] {
    const results: EntityCooccurrence[] = [];
    const now = new Date();

    // Check for vessels near both conflict zones and GPS jamming zones
    for (const vessel of data.vessels) {
        const nearConflicts: string[] = [];
        const nearJamming: string[] = [];
        const nearRegions = new Set<string>();

        for (const conflict of data.conflicts) {
            const dist = haversineKm(
                vessel.latitude,
                vessel.longitude,
                conflict.latitude,
                conflict.longitude,
            );
            if (dist <= 100) {
                // Within 100km of a conflict
                nearConflicts.push(conflict.eventId);
            }
        }

        for (const zone of data.gpsJamming) {
            const dist = haversineKm(
                vessel.latitude,
                vessel.longitude,
                zone.latitude,
                zone.longitude,
            );
            if (dist <= 100) {
                nearJamming.push(zone.id);
            }
        }

        // Check which regions the vessel is in
        for (const region of MONITORED_REGIONS) {
            if (
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    vessel.latitude,
                    vessel.longitude,
                ) <= region.radiusKm
            ) {
                nearRegions.add(region.name);
            }
        }

        if (nearConflicts.length > 0 && nearJamming.length > 0) {
            results.push({
                id: patternId("ec"),
                kind: "entity_cooccurrence",
                title: `Vessel ${vessel.name || vessel.mmsi} in conflict + jamming zone`,
                description: `Vessel ${vessel.name || "MMSI:" + vessel.mmsi} is operating near ${nearConflicts.length} conflict events and ${nearJamming.length} GPS jamming zones simultaneously.`,
                confidence: 0.8,
                detectedAt: now.toISOString(),
                involvedLayers: ["vessels", "conflicts", "gps-jamming"],
                metadata: {
                    entities: [
                        {
                            type: "vessel",
                            id: vessel.mmsi,
                            name: vessel.name || `MMSI:${vessel.mmsi}`,
                        },
                    ],
                    incidentCount:
                        nearConflicts.length + nearJamming.length,
                    regions: Array.from(nearRegions),
                    firstSeen: now.toISOString(),
                    lastSeen: now.toISOString(),
                },
            });
        }
    }

    // Cross-type co-occurrence: regions with both conflicts and GPS jamming
    for (const region of MONITORED_REGIONS) {
        const hasConflicts = data.conflicts.some(
            (c) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    c.latitude,
                    c.longitude,
                ) <= region.radiusKm,
        );

        const hasJamming = data.gpsJamming.some(
            (z) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    z.latitude,
                    z.longitude,
                ) <= region.radiusKm,
        );

        const hasVessels = data.vessels.some(
            (v) =>
                haversineKm(
                    region.center.lat,
                    region.center.lng,
                    v.latitude,
                    v.longitude,
                ) <= region.radiusKm,
        );

        if (hasConflicts && hasJamming) {
            // Check we haven't already flagged a vessel co-occurrence in this region
            const alreadyFlagged = results.some(
                (r) =>
                    r.kind === "entity_cooccurrence" &&
                    r.metadata.regions.includes(region.name),
            );
            if (!alreadyFlagged) {
                const layers = ["conflicts", "gps-jamming"];
                if (hasVessels) layers.push("vessels");

                const conflictCount = data.conflicts.filter(
                    (c) =>
                        haversineKm(
                            region.center.lat,
                            region.center.lng,
                            c.latitude,
                            c.longitude,
                        ) <= region.radiusKm,
                ).length;

                const jammingCount = data.gpsJamming.filter(
                    (z) =>
                        haversineKm(
                            region.center.lat,
                            region.center.lng,
                            z.latitude,
                            z.longitude,
                        ) <= region.radiusKm,
                ).length;

                results.push({
                    id: patternId("ec"),
                    kind: "entity_cooccurrence",
                    title: `Conflict + GPS jamming co-occurrence in ${region.name}`,
                    description: `${region.name} has ${conflictCount} active conflicts and ${jammingCount} GPS jamming zones, indicating coordinated electronic and kinetic activity.`,
                    confidence: 0.7,
                    detectedAt: now.toISOString(),
                    involvedLayers: layers,
                    metadata: {
                        entities: [
                            {
                                type: "region",
                                id: region.name,
                                name: region.name,
                            },
                        ],
                        incidentCount: conflictCount + jammingCount,
                        regions: [region.name],
                        firstSeen: now.toISOString(),
                        lastSeen: now.toISOString(),
                    },
                });
            }
        }
    }

    return results;
}
