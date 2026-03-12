"use client";

import {
    Twitter,
    MessageCircle,
    Landmark,
    Clock,
    ExternalLink,
    Heart,
    Repeat2,
    MessageSquare,
    BarChart3,
    MapPin,
    Tag,
    Video,
    Image,
    User,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { SocialPost, SocialPlatform } from "@/lib/types/social-post";
import {
    getPlatformDisplayName,
    getPlatformColor,
    getSentimentColor,
    getSentimentDisplayLabel,
    formatEngagement,
} from "@/lib/types/social-post";

// ============================================
// Shared detail components (matching entity-details-multi pattern)
// ============================================

function DetailRow({
    icon: Icon,
    label,
    value,
    subValue,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    subValue?: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 shrink-0">
                <Icon className="w-4 h-4 text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                <p className="text-sm text-white font-medium truncate">{value}</p>
                {subValue && <p className="text-xs text-white/40">{subValue}</p>}
            </div>
        </div>
    );
}

function SectionHeader({ title }: { title: string }) {
    return (
        <>
            <Separator className="bg-white/10 my-3" />
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-medium mb-3">
                {title}
            </div>
        </>
    );
}

const platformIcons: Record<SocialPlatform, typeof Twitter> = {
    x: Twitter,
    truth_social: MessageCircle,
    whitehouse: Landmark,
};

// ============================================
// Social Post Details
// ============================================

export function SocialPostDetails({ post }: { post: SocialPost }) {
    const platformColor = getPlatformColor(post.platform);
    const sentimentColor = getSentimentColor(post.sentiment);
    const PlatformIcon = platformIcons[post.platform];
    const showEngagement = post.platform !== "whitehouse";

    return (
        <div className="p-4 space-y-3">
            {/* Post Content */}
            <div>
                <p className="text-[13px] leading-relaxed text-white/80 whitespace-pre-wrap">
                    {post.content}
                </p>
                {post.url && (
                    <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        View Original
                        <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>

            <SectionHeader title="Platform & Author" />

            {/* Platform */}
            <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-white/5 shrink-0">
                    <PlatformIcon className="w-4 h-4" style={{ color: platformColor }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Platform</p>
                    <p className="text-sm text-white font-medium">{getPlatformDisplayName(post.platform)}</p>
                </div>
            </div>

            <DetailRow icon={User} label="Author" value={post.author} />

            <SectionHeader title="Timing" />

            <DetailRow
                icon={Clock}
                label="Posted"
                value={new Date(post.postedAt).toLocaleString()}
            />

            {/* Engagement — only for X / Truth Social */}
            {showEngagement && (
                <>
                    <SectionHeader title="Engagement" />

                    <div className="grid grid-cols-3 gap-2">
                        <div className="flex flex-col items-center p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                            <Heart className="w-3.5 h-3.5 text-rose-400 mb-1" />
                            <span className="text-sm font-semibold text-white">
                                {formatEngagement(post.engagement.likes)}
                            </span>
                            <span className="text-[9px] text-white/30 uppercase">Likes</span>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                            <Repeat2 className="w-3.5 h-3.5 text-green-400 mb-1" />
                            <span className="text-sm font-semibold text-white">
                                {formatEngagement(post.engagement.reposts)}
                            </span>
                            <span className="text-[9px] text-white/30 uppercase">Reposts</span>
                        </div>
                        <div className="flex flex-col items-center p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                            <MessageSquare className="w-3.5 h-3.5 text-blue-400 mb-1" />
                            <span className="text-sm font-semibold text-white">
                                {formatEngagement(post.engagement.replies)}
                            </span>
                            <span className="text-[9px] text-white/30 uppercase">Replies</span>
                        </div>
                    </div>
                </>
            )}

            {/* Sentiment */}
            <SectionHeader title="Sentiment" />

            <div className="flex items-center gap-3">
                <span
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                        backgroundColor: sentimentColor + "1a",
                        color: sentimentColor,
                        border: `1px solid ${sentimentColor}33`,
                    }}
                >
                    {getSentimentDisplayLabel(post.sentiment)}
                </span>

                {post.sentimentScore !== null && (
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${((post.sentimentScore + 1) / 2) * 100}%`,
                                        backgroundColor: sentimentColor,
                                    }}
                                />
                            </div>
                            <span className="text-[10px] text-white/40 font-mono">
                                {post.sentimentScore.toFixed(2)}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Media */}
            {(post.mediaUrls.length > 0 || post.hasVideo) && (
                <>
                    <SectionHeader title="Media" />
                    <div className="flex flex-wrap gap-2">
                        {post.hasVideo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                                <Video className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-xs text-white/60">Video attached</span>
                            </div>
                        )}
                        {post.mediaUrls.length > 0 && !post.hasVideo && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06]">
                                <Image className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-xs text-white/60">
                                    {post.mediaUrls.length} media file{post.mediaUrls.length > 1 ? "s" : ""}
                                </span>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Entities Mentioned */}
            {post.entitiesMentioned.length > 0 && (
                <>
                    <SectionHeader title="Entities Mentioned" />
                    <div className="flex flex-wrap gap-1.5">
                        {post.entitiesMentioned.map((entity) => (
                            <Badge
                                key={entity}
                                variant="outline"
                                className="text-[11px] border-white/10 text-white/60 bg-white/[0.03]"
                            >
                                <Tag className="w-3 h-3 mr-1 text-white/30" />
                                {entity}
                            </Badge>
                        ))}
                    </div>
                </>
            )}

            {/* Geographic References */}
            {post.geoReferences.length > 0 && (
                <>
                    <SectionHeader title="Geographic References" />
                    <div className="flex flex-wrap gap-1.5">
                        {post.geoReferences.map((geo) => (
                            <button
                                key={geo}
                                type="button"
                                className="
                                    inline-flex items-center gap-1 px-2.5 py-1 rounded-md
                                    text-[11px] font-medium
                                    bg-blue-500/10 text-blue-300/80 border border-blue-500/20
                                    hover:bg-blue-500/15 hover:text-blue-300
                                    transition-colors cursor-pointer
                                "
                                title="Fly to location (coming soon)"
                            >
                                <MapPin className="w-3 h-3" />
                                {geo}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
