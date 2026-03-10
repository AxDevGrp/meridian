"use client";

import { Crosshair, Radio, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface EntityActionsProps {
    /** Callback when "Focus on Map" is clicked */
    onFocus: () => void;
    /** Whether the entity is being tracked */
    isTracking?: boolean;
    /** Callback when "Track" is toggled */
    onToggleTrack?: () => void;
    /** Number of nearby entities (for future use) */
    nearbyCount?: number;
}

export function EntityActions({
    onFocus,
    isTracking = false,
    onToggleTrack,
    nearbyCount,
}: EntityActionsProps) {
    return (
        <div className="p-4 border-t border-white/10">
            {/* Action buttons */}
            <div className="flex gap-2 mb-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onFocus}
                    className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                >
                    <Crosshair className="w-4 h-4 mr-2" />
                    Focus on Map
                </Button>

                {onToggleTrack && (
                    <Button
                        variant={isTracking ? "default" : "outline"}
                        size="sm"
                        onClick={onToggleTrack}
                        className={
                            isTracking
                                ? "bg-blue-500 hover:bg-blue-600 text-white"
                                : "bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                        }
                    >
                        <Radio className="w-4 h-4 mr-2" />
                        {isTracking ? "Tracking" : "Track"}
                    </Button>
                )}
            </div>

            <Separator className="bg-white/10 my-3" />

            {/* Related entities section (placeholder) */}
            <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-white/40 font-medium">
                    Related
                </div>

                <div className="flex items-center gap-2 text-sm text-white/60">
                    <Users className="w-4 h-4" />
                    <span>
                        {nearbyCount !== undefined ? (
                            <>
                                <span className="text-white font-medium">{nearbyCount}</span>{" "}
                                nearby aircraft
                            </>
                        ) : (
                            "Nearby data unavailable"
                        )}
                    </span>
                </div>

                {/* Future: Related signals placeholder */}
                <div className="flex items-center gap-2 text-sm text-white/40">
                    <Radio className="w-4 h-4" />
                    <span>Related signals (coming soon)</span>
                </div>
            </div>
        </div>
    );
}