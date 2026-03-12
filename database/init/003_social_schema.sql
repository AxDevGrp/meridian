-- Social Media / News Intelligence Schema

CREATE TYPE social_platform AS ENUM ('x', 'truth_social', 'whitehouse');
CREATE TYPE sentiment_label AS ENUM ('positive', 'negative', 'neutral', 'aggressive', 'urgent');

CREATE TABLE social_posts (
    id UUID DEFAULT uuid_generate_v4(),
    platform social_platform NOT NULL,
    post_id VARCHAR(255) NOT NULL,
    author VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    url VARCHAR(500),
    sentiment sentiment_label,
    sentiment_score DOUBLE PRECISION,         -- -1.0 to 1.0
    engagement_likes INTEGER DEFAULT 0,
    engagement_reposts INTEGER DEFAULT 0,
    engagement_replies INTEGER DEFAULT 0,
    entities_mentioned JSONB DEFAULT '[]',     -- extracted: countries, orgs, people
    geo_references JSONB DEFAULT '[]',         -- extracted: location names
    location GEOGRAPHY(Point, 4326),           -- optional geocoded point
    media_urls JSONB DEFAULT '[]',             -- images, video thumbnails
    has_video BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    posted_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id, recorded_at)
);

SELECT create_hypertable('social_posts', 'recorded_at');

-- Indexes
CREATE INDEX idx_social_platform ON social_posts (platform);
CREATE INDEX idx_social_posted_at ON social_posts (posted_at DESC);
CREATE INDEX idx_social_sentiment ON social_posts (sentiment);
CREATE INDEX idx_social_entities ON social_posts USING GIN (entities_mentioned);
CREATE INDEX idx_social_geo_refs ON social_posts USING GIN (geo_references);
CREATE INDEX idx_social_location ON social_posts USING GIST (location) WHERE location IS NOT NULL;
CREATE INDEX idx_social_has_video ON social_posts (has_video) WHERE has_video = TRUE;
