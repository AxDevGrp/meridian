"use client";

import { useMemo } from "react";
import { Twitter, MessageCircle, Landmark, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";
import {
    getPlatformDisplayName,
    getPlatformColor,
    getSentimentColor,
    getSentimentDisplayLabel,
    formatEngagement,
} from "@/lib/types/social-post";

interface SocialPostCardProps {
    post: SocialPost;
    onClick: () => void;
    compact?: boolean;
}

const platformIcons: Record<SocialPlatform, typeof Twitter> = {
    x: Twitter,
    truth_social: MessageCircle,
    whitehouse: Landmark,
};

/**
 * Compute relative time string from an ISO date
 */
function getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

/**
 * Individual social post card for the intel feed.
 * Dark command-center aesthetic with platform-colored accents.
 */
export function SocialPostCard({ post, onClick, compact = false }: SocialPostCardProps) {
    const PlatformIcon = platformIcons[post.platform];
    const platformColor = getPlatformColor(post.platform);
    const sentimentColor = getSentimentColor(post.sentiment);
    const relativeTime = useMemo(() => getRelativeTime(post.postedAt), [post.postedAt]);

    const truncatedContent = useMemo(() => {
        const limit = compact ? 100 : 150;
        if (post.content.length <= limit) return post.content;
        return post.content.slice(0, limit).trimEnd() + "…";
    }, [post.content, compact]);

    // Only show engagement for X and Truth Social
    const showEngagement = post.platform !== "whitehouse";

    return (
        <button
            type="button"
            onClick={onClick}
            className="
                group w-full text-left
                bg-white/[0.03] hover:bg-white/[0.07]
                border border-white/[0.06] hover:border-white/[0.15]
                rounded-lg p-3.5
                transition-all duration-200
                hover:shadow-[0_0_20px_rgba(255,255,255,0.04)]
                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20
                cursor-pointer
            "
        >
            {/* Header: Platform icon + Author + Timestamp */}
            <div className="flex items-center gap-2 mb-2">
                <PlatformIcon
                    className="w-4 h-4 shrink-0"
                    style={{ color: platformColor }}
                />
                <span className="text-sm font-medium text-white truncate">
                    {post.author}
                </span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-xs text-white/40 whitespace-nowrap ml-auto">
                    {relativeTime}
                </span>
            </div>

            {/* Content */}
            <p className="text-[13px] leading-relaxed text-white/70 mb-2.5">
                {truncatedContent}
            </p>

            {/* Tags row: Sentiment + Geo refs + Video */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {post.sentiment && (
                    <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                            backgroundColor: sentimentColor + "1a",
                            color: sentimentColor,
                            border: `1px solid ${sentimentColor}33`,
                        }}
                    >
                        {getSentimentDisplayLabel(post.sentiment)}
                    </span>
                )}

                {post.geoReferences.map((geo) => (
                    <span
                        key={geo}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06]"
                    >
                        {geo}
                    </span>
                ))}

                {post.hasVideo && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/[0.06]">
                        <Video className="w-3 h-3" />
                        Video
                    </span>
                )}
            </div>

            {/* Engagement row */}
            {showEngagement && (
                <div className="flex items-center gap-4 text-[11px] text-white/35">
                    <span className="flex items-center gap-1">
                        <span>❤️</span>
                        {formatEngagement(post.engagement.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                        <span>🔄</span>
                        {formatEngagement(post.engagement.reposts)}
                    </span>
                    <span className="flex items-center gap-1">
                        <span>💬</span>
                        {formatEngagement(post.engagement.replies)}
                    </span>
                </div>
            )}
        </button>
    );
}
