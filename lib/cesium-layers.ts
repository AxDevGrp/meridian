/**
 * Cesium rendering functions for all data source layers
 * Manages PointPrimitiveCollections and Entity rendering for:
 * - Vessels (AIS)
 * - Satellites (TLE)
 * - Conflict events (ACLED)
 * - GPS Jamming zones
 */

import * as Cesium from "cesium";
import type { Vessel } from "@/lib/types/vessel";
import type { Satellite } from "@/lib/types/satellite";
import type { ConflictEvent } from "@/lib/types/conflict";
import type { GPSJammingZone } from "@/lib/types/gps-jamming";
import type { SocialPost } from "@/lib/types/social-post";
import { getVesselColor } from "@/lib/types/vessel";
import { getSatelliteColor, classifySatellitePurpose } from "@/lib/types/satellite";
import { getConflictColor } from "@/lib/types/conflict";
import { getJammingSeverityColor } from "@/lib/types/gps-jamming";

// ============================================
// Collection Types
// ============================================

export interface PrimitiveLayerCollection {
    pointCollection: Cesium.PointPrimitiveCollection;
    pointMap: Map<string, Cesium.PointPrimitive>;
}

export interface EntityLayerCollection {
    entities: Map<string, Cesium.Entity>;
}

export interface AllLayerCollections {
    vessels: PrimitiveLayerCollection;
    satellites: PrimitiveLayerCollection;
    conflicts: PrimitiveLayerCollection;
    gpsJamming: EntityLayerCollection;
}

// ============================================
// Collection Management
// ============================================

/**
 * Create all layer collections for multi-source rendering
 */
export function createAllLayerCollections(viewer: Cesium.Viewer): AllLayerCollections {
    const vessels: PrimitiveLayerCollection = {
        pointCollection: new Cesium.PointPrimitiveCollection(),
        pointMap: new Map(),
    };
    viewer.scene.primitives.add(vessels.pointCollection);

    const satellites: PrimitiveLayerCollection = {
        pointCollection: new Cesium.PointPrimitiveCollection(),
        pointMap: new Map(),
    };
    viewer.scene.primitives.add(satellites.pointCollection);

    const conflicts: PrimitiveLayerCollection = {
        pointCollection: new Cesium.PointPrimitiveCollection(),
        pointMap: new Map(),
    };
    viewer.scene.primitives.add(conflicts.pointCollection);

    const gpsJamming: EntityLayerCollection = {
        entities: new Map(),
    };

    return { vessels, satellites, conflicts, gpsJamming };
}

/**
 * Destroy all layer collections
 */
export function destroyAllLayerCollections(viewer: Cesium.Viewer, collections: AllLayerCollections): void {
    // Destroy point collections
    const primitiveLayers = [collections.vessels, collections.satellites, collections.conflicts];
    for (const layer of primitiveLayers) {
        if (!layer.pointCollection.isDestroyed()) {
            viewer.scene.primitives.remove(layer.pointCollection);
            layer.pointCollection.destroy();
        }
        layer.pointMap.clear();
    }

    // Remove GPS jamming entities
    for (const entity of collections.gpsJamming.entities.values()) {
        viewer.entities.remove(entity);
    }
    collections.gpsJamming.entities.clear();
}

// ============================================
// Vessel Rendering
// ============================================

/**
 * Color palette for vessels
 */
const VESSEL_COLORS = {
    selected: Cesium.Color.fromCssColorString("#ff0066"),
    outline: Cesium.Color.WHITE.withAlpha(0.6),
};

/**
 * Update vessel positions on the globe
 */
export function updateVesselPositions(
    collection: PrimitiveLayerCollection,
    vessels: Vessel[],
    selectedMmsi?: string
): void {
    const { pointCollection, pointMap } = collection;
    const seenIds = new Set<string>();

    for (const vessel of vessels) {
        if (vessel.longitude === null || vessel.latitude === null) continue;

        seenIds.add(vessel.mmsi);

        const position = Cesium.Cartesian3.fromDegrees(vessel.longitude, vessel.latitude, 0);
        const color = vessel.mmsi === selectedMmsi
            ? VESSEL_COLORS.selected
            : Cesium.Color.fromCssColorString(getVesselColor(vessel.vesselType));

        const existing = pointMap.get(vessel.mmsi);

        if (existing) {
            existing.position = position;
            existing.color = color;
        } else {
            const point = pointCollection.add({
                position,
                pixelSize: 10,
                color,
                outlineColor: VESSEL_COLORS.outline,
                outlineWidth: 1.5,
                id: `vessel:${vessel.mmsi}`,
            });
            pointMap.set(vessel.mmsi, point);
        }
    }

    // Remove vessels no longer in data
    for (const [mmsi, point] of pointMap) {
        if (!seenIds.has(mmsi)) {
            pointCollection.remove(point);
            pointMap.delete(mmsi);
        }
    }
}

// ============================================
// Satellite Rendering
// ============================================

/**
 * Color palette for satellites
 */
const SATELLITE_COLORS = {
    selected: Cesium.Color.fromCssColorString("#ff0066"),
    outline: Cesium.Color.WHITE.withAlpha(0.4),
};

/**
 * Update satellite positions on the globe
 */
export function updateSatellitePositions(
    collection: PrimitiveLayerCollection,
    satellites: Satellite[],
    selectedNoradId?: string
): void {
    const { pointCollection, pointMap } = collection;
    const seenIds = new Set<string>();

    for (const sat of satellites) {
        seenIds.add(sat.noradId);

        // Altitude in meters (position.altitude is in km)
        const altitudeMeters = sat.position.altitude * 1000;

        const position = Cesium.Cartesian3.fromDegrees(
            sat.position.longitude,
            sat.position.latitude,
            altitudeMeters
        );

        const color = sat.noradId === selectedNoradId
            ? SATELLITE_COLORS.selected
            : Cesium.Color.fromCssColorString(
                getSatelliteColor(classifySatellitePurpose(sat.name))
            );

        // Size based on orbit type - space stations are larger
        const pixelSize = sat.purpose === "space_station" ? 8 : 4;

        const existing = pointMap.get(sat.noradId);

        if (existing) {
            existing.position = position;
            existing.color = color;
        } else {
            const point = pointCollection.add({
                position,
                pixelSize,
                color,
                outlineColor: SATELLITE_COLORS.outline,
                outlineWidth: 1,
                id: `satellite:${sat.noradId}`,
            });
            pointMap.set(sat.noradId, point);
        }
    }

    // Remove satellites no longer in data
    for (const [noradId, point] of pointMap) {
        if (!seenIds.has(noradId)) {
            pointCollection.remove(point);
            pointMap.delete(noradId);
        }
    }
}

// ============================================
// Conflict Event Rendering
// ============================================

/**
 * Color palette for conflicts
 */
const CONFLICT_COLORS = {
    selected: Cesium.Color.fromCssColorString("#ffffff"),
    outline: Cesium.Color.BLACK.withAlpha(0.5),
};

/**
 * Update conflict event positions on the globe
 */
export function updateConflictPositions(
    collection: PrimitiveLayerCollection,
    conflicts: ConflictEvent[],
    selectedEventId?: string
): void {
    const { pointCollection, pointMap } = collection;
    const seenIds = new Set<string>();

    for (const event of conflicts) {
        seenIds.add(event.eventId);

        const position = Cesium.Cartesian3.fromDegrees(event.longitude, event.latitude, 100);

        const color = event.eventId === selectedEventId
            ? CONFLICT_COLORS.selected
            : Cesium.Color.fromCssColorString(getConflictColor(event.eventType));

        // Size based on fatalities
        const baseSize = 9;
        const fatalityBonus = Math.min(event.fatalities.reported * 0.3, 8);
        const pixelSize = baseSize + fatalityBonus;

        const existing = pointMap.get(event.eventId);

        if (existing) {
            existing.position = position;
            existing.color = color;
            existing.pixelSize = pixelSize;
        } else {
            const point = pointCollection.add({
                position,
                pixelSize,
                color,
                outlineColor: CONFLICT_COLORS.outline,
                outlineWidth: 2,
                id: `conflict:${event.eventId}`,
            });
            pointMap.set(event.eventId, point);
        }
    }

    // Remove events no longer in data
    for (const [eventId, point] of pointMap) {
        if (!seenIds.has(eventId)) {
            pointCollection.remove(point);
            pointMap.delete(eventId);
        }
    }
}

// ============================================
// GPS Jamming Zone Rendering
// ============================================

/**
 * Update GPS jamming zones on the globe (rendered as ellipses/entities)
 */
export function updateGPSJammingZones(
    viewer: Cesium.Viewer,
    collection: EntityLayerCollection,
    zones: GPSJammingZone[],
    selectedZoneId?: string
): void {
    const seenIds = new Set<string>();

    for (const zone of zones) {
        seenIds.add(zone.id);

        const color = Cesium.Color.fromCssColorString(
            getJammingSeverityColor(zone.severity)
        ).withAlpha(zone.id === selectedZoneId ? 0.4 : 0.15);

        const outlineColor = Cesium.Color.fromCssColorString(
            getJammingSeverityColor(zone.severity)
        ).withAlpha(zone.id === selectedZoneId ? 0.9 : 0.5);

        const radiusMeters = zone.radiusKm * 1000;

        const existing = collection.entities.get(zone.id);

        if (existing) {
            // Update existing entity
            if (existing.ellipse) {
                existing.ellipse.semiMajorAxis = new Cesium.ConstantProperty(radiusMeters);
                existing.ellipse.semiMinorAxis = new Cesium.ConstantProperty(radiusMeters);
                existing.ellipse.material = new Cesium.ColorMaterialProperty(color);
                existing.ellipse.outlineColor = new Cesium.ConstantProperty(outlineColor);
            }
        } else {
            // Create new entity
            const entity = viewer.entities.add({
                id: `gps-jamming:${zone.id}`,
                position: Cesium.Cartesian3.fromDegrees(zone.longitude, zone.latitude),
                ellipse: {
                    semiMajorAxis: radiusMeters,
                    semiMinorAxis: radiusMeters,
                    material: color,
                    outline: true,
                    outlineColor,
                    outlineWidth: 2,
                    height: 0,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                },
                label: {
                    text: zone.name,
                    font: "11px sans-serif",
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -10),
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
            });

            collection.entities.set(zone.id, entity);
        }
    }

    // Remove zones no longer in data
    for (const [zoneId, entity] of collection.entities) {
        if (!seenIds.has(zoneId)) {
            viewer.entities.remove(entity);
            collection.entities.delete(zoneId);
        }
    }
}

// ============================================
// Layer Visibility Controls
// ============================================

/**
 * Set visibility for a point primitive collection
 */
export function setPrimitiveLayerVisibility(
    collection: PrimitiveLayerCollection,
    visible: boolean
): void {
    collection.pointCollection.show = visible;
}

/**
 * Set visibility for entity-based layer
 */
export function setEntityLayerVisibility(
    collection: EntityLayerCollection,
    visible: boolean
): void {
    for (const entity of collection.entities.values()) {
        entity.show = visible;
    }
}

// ============================================
// Click Detection (Multi-Source)
// ============================================

/**
 * Identify which entity was clicked across all layers
 * Returns the layer type and entity ID, or null
 */
export function getEntityAtPosition(
    viewer: Cesium.Viewer,
    windowPosition: { x: number; y: number },
    collections: AllLayerCollections
): { layer: string; id: string } | null {
    const pickedObject = viewer.scene.pick(
        new Cesium.Cartesian2(windowPosition.x, windowPosition.y)
    );

    if (!pickedObject) return null;

    // Check for entity-based layers (GPS jamming)
    if (pickedObject.id && pickedObject.id instanceof Cesium.Entity) {
        const entityId = pickedObject.id.id;
        if (entityId && typeof entityId === "string") {
            if (entityId.startsWith("gps-jamming:")) {
                return { layer: "gps-jamming", id: entityId.replace("gps-jamming:", "") };
            }
        }
    }

    // Check for PointPrimitive picks — the `id` property contains
    // the string we assigned when creating the point (e.g., "vessel:123456")
    const pickedId: unknown = pickedObject.id;

    if (typeof pickedId === "string") {
        if (pickedId.startsWith("vessel:")) {
            return { layer: "vessel", id: pickedId.replace("vessel:", "") };
        }
        if (pickedId.startsWith("satellite:")) {
            return { layer: "satellite", id: pickedId.replace("satellite:", "") };
        }
        if (pickedId.startsWith("conflict:")) {
            return { layer: "conflict", id: pickedId.replace("conflict:", "") };
        }
    }

    // Fallback: check primitive by reference for PointPrimitiveCollection matches
    if (pickedObject.primitive) {
        // Check vessels
        for (const [mmsi, point] of collections.vessels.pointMap) {
            if (point === pickedObject.primitive) {
                return { layer: "vessel", id: mmsi };
            }
        }

        // Check satellites
        for (const [noradId, point] of collections.satellites.pointMap) {
            if (point === pickedObject.primitive) {
                return { layer: "satellite", id: noradId };
            }
        }

        // Check conflicts
        for (const [eventId, point] of collections.conflicts.pointMap) {
            if (point === pickedObject.primitive) {
                return { layer: "conflict", id: eventId };
            }
        }
    }

    return null;
}

/**
 * Clear all entities from all collections
 */
export function clearAllCollections(viewer: Cesium.Viewer, collections: AllLayerCollections): void {
    // Clear point collections
    collections.vessels.pointCollection.removeAll();
    collections.vessels.pointMap.clear();

    collections.satellites.pointCollection.removeAll();
    collections.satellites.pointMap.clear();

    collections.conflicts.pointCollection.removeAll();
    collections.conflicts.pointMap.clear();

    // Clear entity collections
    for (const entity of collections.gpsJamming.entities.values()) {
        viewer.entities.remove(entity);
    }
    collections.gpsJamming.entities.clear();
}

// ============================================
// Social Post Globe Markers (Skeleton)
// ============================================

/**
 * Render social post markers on the globe.
 * Currently a skeleton — the sample data posts don't have lat/lng coordinates yet.
 * Once geocoding is added (NLP phase), posts with geoReferences will get coordinates
 * and this function will render billboard markers colored by platform.
 *
 * For now, this handles visibility toggling and is a placeholder for future rendering.
 */
export function renderSocialPosts(
    _viewer: Cesium.Viewer,
    _posts: SocialPost[],
    _visible: boolean
): void {
    // Placeholder: social posts don't have coordinates yet.
    // When geocoded lat/lng is available on SocialPost, this function will:
    // 1. Clear existing social markers
    // 2. If !visible, return early
    // 3. For each post with coordinates, add a billboard entity:
    //    - Icon: newspaper/speech-bubble style
    //    - Color: getPlatformColor(post.platform)
    //    - ID: `social:${post.id}`
    //    - Label: post.author
    // 4. Store references for click detection
}
