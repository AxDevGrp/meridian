"use client";

import { Suspense } from "react";
import { GlobeContainer } from "@/components/globe-container";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { useAircraft } from "@/lib/hooks/use-aircraft";
import { useUIStore, useSidebarActions } from "@/lib/stores/ui-store";

function GlobeWithAircraft() {
  const { aircraft } = useAircraft();
  const selectedEntityId = useUIStore((state) => state.selectedEntityId);
  const { selectEntity, deselectEntity } = useSidebarActions();

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
