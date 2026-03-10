"use client";

import { Suspense, useEffect, useRef } from "react";
import { GlobeContainer } from "@/components/globe-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useAircraft } from "@/lib/hooks/use-aircraft";
import { useUIStore, useSidebarActions } from "@/lib/stores/ui-store";
import { useAircraftStore } from "@/lib/stores/aircraft-store";

function GlobeWithAircraft() {
  const aircraft = useAircraftStore((state) => state.aircraft);
  const selectedEntityId = useUIStore((state) => state.selectedEntityId);
  const { selectEntity, deselectEntity } = useSidebarActions();

  // Use refs to ensure we only start polling once
  const pollingStarted = useRef(false);
  const startPolling = useAircraftStore((state) => state.startPolling);
  const stopPolling = useAircraftStore((state) => state.stopPolling);

  // Start polling on mount - only once
  useEffect(() => {
    if (pollingStarted.current) return;
    pollingStarted.current = true;

    // Use requestAnimationFrame to ensure we're outside the render phase
    const rafId = requestAnimationFrame(() => {
      startPolling();
    });

    return () => {
      cancelAnimationFrame(rafId);
      stopPolling();
    };
  }, [startPolling, stopPolling]);

  return (
    <>
      <GlobeContainer
        className="absolute inset-0 w-full h-full"
        aircraft={aircraft}
        selectedAircraftIcao={selectedEntityId}
        onAircraftClick={(icao) => {
          if (icao === selectedEntityId) {
            deselectEntity();
          } else {
            selectEntity("aircraft", icao);
          }
        }}
      />
      <Sidebar />
    </>
  );
}

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* Full-screen Globe */}
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
        <GlobeWithAircraft />
      </Suspense>

      {/* Header */}
      <Header />
    </main>
  );
}
