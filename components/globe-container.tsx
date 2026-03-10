"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamic import with ssr: false since Cesium requires browser APIs
export const GlobeContainer = dynamic(() => import("@/components/globe"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full absolute inset-0 flex items-center justify-center bg-background">
            <div className="space-y-4 text-center">
                <Skeleton className="h-8 w-48 mx-auto" />
                <Skeleton className="h-4 w-32 mx-auto" />
            </div>
        </div>
    ),
});