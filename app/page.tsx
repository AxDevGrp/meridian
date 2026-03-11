"use client";

import { Suspense, useMemo } from "react";
import { GlobeContainer } from "@/components/globe-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { LayerPanel } from "@/components/layers";
import { useAircraftStore } from "@/lib/stores/aircraft-store";
import { useDataStore } from "@/lib/stores/data-store";
import { useUIStore, useSidebarActions } from "@/lib/stores/ui-store";
import { useLayerStore } from "@/lib/stores/layer-store";
import type { LayerType } from "@/lib/types/geo-event";

function GlobeWithAllData() {
  // Aircraft data (Phase 1)
  const aircraft = useAircraftStore((state) => state.aircraft);

  // Multi-source data (Phase 2)
  const vessels = useDataStore((state) => state.vessels.data);
  const satellites = useDataStore((state) => state.satellites.data);
  const conflicts = useDataStore((state) => state.conflicts.data);
  const gpsJammingZones = useDataStore((state) => state.gpsJamming.data);

  // UI state
  const selectedEntityId = useUIStore((state) => state.selectedEntityId);
  const selectedEntityType = useUIStore((state) => state.selectedEntityType);
  const { selectEntity, deselectEntity } = useSidebarActions();

  // Layer visibility
  const layers = useLayerStore((state) => state.layers);
  const layerVisibility = useMemo(() => {
    const visibility: Record<LayerType, boolean> = {
      aircraft: true,
      vessel: true,
      satellite: true,
      conflict: true,
      "gps-jamming": true,
    };
    for (const layer of layers) {
      visibility[layer.id] = layer.enabled;
    }
    return visibility;
  }, [layers]);

  return (
    <>
      <GlobeContainer
        className="absolute inset-0 w-full h-full"
        aircraft={aircraft}
        selectedAircraftIcao={selectedEntityType === "aircraft" ? selectedEntityId : null}
        onAircraftClick={(icao) => {
          if (icao === selectedEntityId && selectedEntityType === "aircraft") {
            deselectEntity();
          } else {
            selectEntity("aircraft", icao);
          }
        }}
        vessels={vessels}
        satellites={satellites}
        conflicts={conflicts}
        gpsJammingZones={gpsJammingZones}
        layerVisibility={layerVisibility}
        selectedEntityId={selectedEntityId}
        selectedEntityLayer={selectedEntityType}
        onEntityClick={(layer: LayerType, id: string) => {
          if (id === selectedEntityId && layer === selectedEntityType) {
            deselectEntity();
          } else {
            selectEntity(layer, id);
          }
        }}
      />
      <Sidebar />
      <LayerPanel />
    </>
  );
}

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* Full-screen Globe with all data layers */}
      <Suspense
        fallback={
          <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-background">
            <div className="space-y-4 text-center">
              <Skeleton className="h-8 w-48 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
            </div>
          </div>
        }
      >
        <GlobeWithAllData />
      </Suspense>

      {/* Header */}
      <Header />
    </main>
  );
}
