/**
 * Cesium rendering module for analytics risk heat map overlay.
 * Renders semi-transparent colored ellipses on the globe for each monitored region.
 */

import type { RiskScore, RiskLevel } from "@/lib/types/analytics";

/** Color mapping for risk levels (RGBA) */
function getRiskHeatMapColor(level: RiskLevel): { red: number; green: number; blue: number } {
    switch (level) {
        case "critical":
            return { red: 239, green: 68, blue: 68 };   // red-500
        case "high":
            return { red: 249, green: 115, blue: 22 };   // orange-500
        case "elevated":
            return { red: 234, green: 179, blue: 8 };    // yellow-500
        case "moderate":
            return { red: 59, green: 130, blue: 246 };   // blue-500
        case "low":
            return { red: 34, green: 197, blue: 94 };    // green-500
    }
}

/** Opacity based on score (0–100): maps to 0.15–0.30 */
function getHeatMapOpacity(score: number): number {
    const normalized = Math.min(Math.max(score, 0), 100) / 100;
    return 0.15 + normalized * 0.15;
}

/**
 * Render risk heat map ellipses on the globe.
 * For each region with a risk score, renders a semi-transparent colored ellipse.
 */
export function renderRiskHeatMap(
    viewer: any, // Cesium.Viewer
    riskScores: RiskScore[],
    existingEntities: Map<string, any>,
): Map<string, any> {
    // Dynamically import Cesium to avoid SSR issues
    const Cesium = (window as any).Cesium;
    if (!Cesium || !viewer) return existingEntities;

    const newEntities = new Map<string, any>();
    const processedIds = new Set<string>();

    for (const rs of riskScores) {
        const entityId = `risk-heatmap-${rs.regionName.replace(/\s+/g, "-").toLowerCase()}`;
        processedIds.add(entityId);

        const color = getRiskHeatMapColor(rs.riskLevel);
        const opacity = getHeatMapOpacity(rs.overallScore);
        const semiAxisM = rs.regionRadiusKm * 1000;

        // Check if entity already exists
        const existing = existingEntities.get(entityId);

        if (existing) {
            // Update existing entity
            try {
                existing.position = Cesium.Cartesian3.fromDegrees(
                    rs.regionCenter.lng,
                    rs.regionCenter.lat,
                );
                existing.ellipse.semiMajorAxis = semiAxisM;
                existing.ellipse.semiMinorAxis = semiAxisM;
                existing.ellipse.material = new Cesium.ColorMaterialProperty(
                    new Cesium.Color(color.red / 255, color.green / 255, color.blue / 255, opacity),
                );
                existing.ellipse.outlineColor = new Cesium.Color(
                    color.red / 255,
                    color.green / 255,
                    color.blue / 255,
                    opacity + 0.1,
                );
                newEntities.set(entityId, existing);
            } catch {
                // If update fails, remove and recreate
                try { viewer.entities.remove(existing); } catch { /* noop */ }
            }
        }

        if (!newEntities.has(entityId)) {
            // Create new entity
            try {
                const entity = viewer.entities.add({
                    id: entityId,
                    name: `Risk: ${rs.regionName}`,
                    position: Cesium.Cartesian3.fromDegrees(
                        rs.regionCenter.lng,
                        rs.regionCenter.lat,
                    ),
                    ellipse: {
                        semiMajorAxis: semiAxisM,
                        semiMinorAxis: semiAxisM,
                        material: new Cesium.ColorMaterialProperty(
                            new Cesium.Color(
                                color.red / 255,
                                color.green / 255,
                                color.blue / 255,
                                opacity,
                            ),
                        ),
                        outline: true,
                        outlineColor: new Cesium.Color(
                            color.red / 255,
                            color.green / 255,
                            color.blue / 255,
                            opacity + 0.1,
                        ),
                        outlineWidth: 1,
                        height: 0,
                        granularity: Cesium.Math.toRadians(2),
                    },
                });
                newEntities.set(entityId, entity);
            } catch (err) {
                console.warn(`Failed to create risk heat map entity for ${rs.regionName}:`, err);
            }
        }
    }

    // Remove stale entities
    for (const [id, entity] of existingEntities) {
        if (!processedIds.has(id)) {
            try {
                viewer.entities.remove(entity);
            } catch { /* noop */ }
        }
    }

    return newEntities;
}

/**
 * Remove all risk heat map entities from the globe.
 */
export function clearRiskHeatMap(
    viewer: any, // Cesium.Viewer
    entities: Map<string, any>,
): void {
    if (!viewer) return;

    for (const [, entity] of entities) {
        try {
            viewer.entities.remove(entity);
        } catch { /* noop */ }
    }
    entities.clear();
}
