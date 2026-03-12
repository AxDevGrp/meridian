"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, Newspaper, AlertCircle, FlaskConical } from "lucide-react";
import { SocialPostCard } from "./social-post-card";
import { PlatformFilterTabs } from "./platform-filter-tabs";
import { useSocialFeed } from "@/lib/stores/data-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { SocialPlatform } from "@/lib/types/social-post";

type FilterValue = SocialPlatform | "all";

/**
 * Collapsible bottom drawer panel displaying the social media / news intel feed.
 * Slides up from the bottom of the viewport, overlaying the globe.
 */
export function IntelFeed() {
    const [expanded, setExpanded] = useState(false);
    const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
    const { posts, isLoading, error, lastUpdated, isSampleData } = useSocialFeed();
    const selectEntity = useUIStore((state) => state.selectEntity);

    // Compute per-platform counts
    const counts = useMemo(() => {
        const c: Record<FilterValue, number> = {
            all: posts.length,
            x: 0,
            truth_social: 0,
            whitehouse: 0,
        };
        for (const p of posts) {
            c[p.platform]++;
        }
        return c;
    }, [posts]);

    // Filter & sort posts
    const filteredPosts = useMemo(() => {
        const filtered = activeFilter === "all"
            ? posts
            : posts.filter((p) => p.platform === activeFilter);

        return [...filtered].sort(
            (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
        );
    }, [posts, activeFilter]);

    const handleCardClick = useCallback(
        (postId: string) => {
            selectEntity("social", postId);
        },
        [selectEntity]
    );

    const lastUpdatedLabel = useMemo(() => {
        if (!lastUpdated) return null;
        const diff = Date.now() - lastUpdated.getTime();
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return "just now";
        const min = Math.floor(sec / 60);
        return `${min}m ago`;
    }, [lastUpdated]);

    return (
        <div
            className={`
                fixed bottom-0 left-0 right-0 z-30
                transition-all duration-300 ease-out
                ${expanded ? "h-[45vh]" : "h-12"}
            `}
        >
            {/* Glass panel */}
            <div className="h-full flex flex-col bg-black/80 backdrop-blur-xl border-t border-white/10 rounded-t-xl overflow-hidden">

                {/* Drag handle / collapse toggle */}
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="
                        flex items-center justify-between w-full px-4 py-2.5
                        hover:bg-white/[0.03] transition-colors duration-150
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                        shrink-0
                    "
                    aria-label={expanded ? "Collapse intel feed" : "Expand intel feed"}
                >
                    <div className="flex items-center gap-2.5">
                        {/* Drag pill indicator */}
                        <div className="w-8 h-1 rounded-full bg-white/20 mx-auto md:mx-0 md:hidden" />

                        <Newspaper className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-medium text-white/80">Intel Feed</span>

                        {/* Post count */}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/50">
                            {posts.length}
                        </span>

                        {/* Sample data indicator */}
                        {isSampleData && (
                            <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-amber-500/30 text-amber-400/70 gap-1"
                            >
                                <FlaskConical className="w-2.5 h-2.5" />
                                Sample
                            </Badge>
                        )}

                        {/* Last updated */}
                        {lastUpdatedLabel && (
                            <span className="text-[10px] text-white/25 hidden sm:inline">
                                Updated {lastUpdatedLabel}
                            </span>
                        )}
                    </div>

                    {expanded ? (
                        <ChevronDown className="w-4 h-4 text-white/40" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-white/40" />
                    )}
                </button>

                {/* Expanded content */}
                {expanded && (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Filter tabs */}
                        <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
                            <PlatformFilterTabs
                                activeFilter={activeFilter}
                                onFilterChange={setActiveFilter}
                                counts={counts}
                            />
                        </div>

                        {/* Feed content */}
                        <ScrollArea className="flex-1">
                            <div className="p-3 space-y-2">
                                {/* Loading state */}
                                {isLoading && posts.length === 0 && (
                                    <div className="space-y-2">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="bg-white/[0.03] rounded-lg p-3.5 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <Skeleton className="h-4 w-4 rounded" />
                                                    <Skeleton className="h-4 w-24" />
                                                    <Skeleton className="h-3 w-12 ml-auto" />
                                                </div>
                                                <Skeleton className="h-4 w-full" />
                                                <Skeleton className="h-4 w-3/4" />
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-4 w-16 rounded-full" />
                                                    <Skeleton className="h-4 w-12 rounded-full" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Error state */}
                                {error && (
                                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                        <p className="text-sm text-red-300">{error}</p>
                                    </div>
                                )}

                                {/* Empty state */}
                                {!isLoading && !error && filteredPosts.length === 0 && (
                                    <div className="text-center py-8">
                                        <Newspaper className="w-8 h-8 text-white/15 mx-auto mb-2" />
                                        <p className="text-sm text-white/30">
                                            {activeFilter === "all"
                                                ? "No posts available"
                                                : `No posts from this platform`}
                                        </p>
                                    </div>
                                )}

                                {/* Post cards — horizontal scroll on mobile, grid on desktop */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                    {filteredPosts.map((post) => (
                                        <SocialPostCard
                                            key={post.id}
                                            post={post}
                                            onClick={() => handleCardClick(post.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
}
