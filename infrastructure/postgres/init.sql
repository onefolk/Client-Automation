-- ==============================================================================
-- OneFolk Client Intelligence Database Schema
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Search Sessions
CREATE TABLE IF NOT EXISTS searches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    query TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    providers_selected TEXT[] NOT NULL DEFAULT '{}',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    total_discovered INT NOT NULL DEFAULT 0,
    total_saved INT NOT NULL DEFAULT 0,
    total_enriched INT NOT NULL DEFAULT 0,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_ms BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at DESC);

-- Master Businesses
CREATE TABLE IF NOT EXISTS businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    sub_industry VARCHAR(100),
    description TEXT,
    
    -- Location
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(100) NOT NULL DEFAULT 'UAE',
    country_code VARCHAR(10),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Contact
    phone VARCHAR(100),
    normalized_phone VARCHAR(100),
    email VARCHAR(255),
    website VARCHAR(500),
    domain VARCHAR(255),

    -- Reputation
    rating NUMERIC(3, 2),
    review_count INT DEFAULT 0,

    -- Digital Presence Flags / Status
    has_website BOOLEAN DEFAULT FALSE,
    has_ssl BOOLEAN DEFAULT FALSE,
    is_mobile_friendly BOOLEAN DEFAULT FALSE,
    website_load_time_ms INT,

    -- Status & Scores
    status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    priority_score INT NOT NULL DEFAULT 50,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    data_completeness INT NOT NULL DEFAULT 0,

    -- Timestamps
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_enriched_at TIMESTAMPTZ,
    last_analyzed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_domain ON businesses(domain);
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_name ON businesses(normalized_name);
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_phone ON businesses(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_businesses_email ON businesses(email);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_country ON businesses(country);
CREATE INDEX IF NOT EXISTS idx_businesses_industry ON businesses(industry);
CREATE INDEX IF NOT EXISTS idx_businesses_priority ON businesses(priority);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

-- Search Results link
CREATE TABLE IF NOT EXISTS search_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    provider_id VARCHAR(100) NOT NULL,
    rank_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(search_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_search_results_search_id ON search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_search_results_business_id ON search_results(business_id);

-- Sources & Data Provenance
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    base_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    source_code VARCHAR(100) NOT NULL,
    source_url TEXT,
    raw_payload JSONB NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_records_business ON source_records(business_id);

-- Public Contacts
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    contact_type VARCHAR(50) NOT NULL, -- email, phone, whatsapp, linkedin, form
    value VARCHAR(255) NOT NULL,
    label VARCHAR(100), -- general, sales, support, founder, etc.
    full_name VARCHAR(255),
    title VARCHAR(255),
    source_url TEXT,
    confidence NUMERIC(4, 3) DEFAULT 1.0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_business ON contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_contacts_value ON contacts(value);

-- Websites & Crawl Results
CREATE TABLE IF NOT EXISTS websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
    url VARCHAR(500) NOT NULL,
    is_reachable BOOLEAN DEFAULT TRUE,
    status_code INT,
    has_ssl BOOLEAN DEFAULT FALSE,
    title VARCHAR(500),
    meta_description TEXT,
    pages_crawled JSONB DEFAULT '[]'::jsonb,
    technologies JSONB DEFAULT '[]'::jsonb,
    performance_score INT,
    last_crawled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social Profiles
CREATE TABLE IF NOT EXISTS social_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- instagram, facebook, linkedin, youtube, tiktok, x
    url VARCHAR(500) NOT NULL,
    handle VARCHAR(100),
    follower_count INT,
    post_count INT,
    is_active BOOLEAN DEFAULT TRUE,
    last_posted_at TIMESTAMPTZ,
    bio TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_profiles_business ON social_profiles(business_id);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    rating NUMERIC(3, 2) NOT NULL,
    review_count INT NOT NULL DEFAULT 0,
    sentiment_score NUMERIC(4, 3),
    recent_snippet TEXT,
    source_url TEXT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);

-- Technologies
CREATE TABLE IF NOT EXISTS technologies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- cms, analytics, booking, payment, chat, crm, hosting
    name VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    confidence NUMERIC(4, 3) DEFAULT 1.0,
    evidence TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technologies_business ON technologies(business_id);

-- Fact Store
CREATE TABLE IF NOT EXISTS facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL, -- website, social, contact, technology, reputation, marketing
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    source VARCHAR(100) NOT NULL,
    source_url TEXT,
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 1.0,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facts_business ON facts(business_id);
CREATE INDEX IF NOT EXISTS idx_facts_key ON facts(key);

-- AI Analyses (Grok interpretation)
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL DEFAULT 'grok-beta',
    digital_presence_score INT NOT NULL DEFAULT 0,
    website_score INT NOT NULL DEFAULT 0,
    social_score INT NOT NULL DEFAULT 0,
    seo_score INT NOT NULL DEFAULT 0,
    lead_capture_score INT NOT NULL DEFAULT 0,
    reputation_score INT NOT NULL DEFAULT 0,
    marketing_maturity VARCHAR(50) NOT NULL DEFAULT 'EMERGING',
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_business ON analyses(business_id);

-- Opportunities & Agency Value Mapping
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    impact VARCHAR(50) NOT NULL DEFAULT 'HIGH', -- HIGH, MEDIUM, LOW
    onefolk_service VARCHAR(100) NOT NULL,
    service_tier VARCHAR(50) DEFAULT 'STANDARD',
    confidence NUMERIC(4, 3) NOT NULL DEFAULT 0.90,
    estimated_revenue_potential VARCHAR(100),
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'IDENTIFIED', -- IDENTIFIED, PRESENTED, ACCEPTED, REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_business ON opportunities(business_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_service ON opportunities(onefolk_service);
CREATE INDEX IF NOT EXISTS idx_opportunities_impact ON opportunities(impact);

-- Activity Timeline
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    search_id UUID REFERENCES searches(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_business ON activities(business_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Background Jobs Tracking
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
