# ONEFOLK CLIENT INTELLIGENCE

> **AI-Powered Client Discovery and Intelligence Platform for  Agency**

OneFolk Client Intelligence is a high-performance, local-first platform designed to help digital agencies discover high-fit prospective clients across any industry, verify and normalize their public digital presence, detect operational gaps (e.g. missing booking systems, weak lead capture, unoptimized websites), and calculate deterministic agency value creation opportunities.

---

## 🏛️ Architecture Overview

The system follows a strict **modular-monolith ** design with background workers, orchestrated around four non-overlapping conceptual stages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. COLLECT                                                                  │
│    Search Sessions, Multi-Query Planning, Mock/Public Provider Ingestion,   │
│    HTTP Crawler, Contact Discovery, Social Discovery, Tech Fingerprinting   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. VERIFY                                                                   │
│    Standardized Normalization, Deterministic Entity Resolution & Deduplication,│
│    100% Raw Source Provenance Tracking, Confidence Scoring                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. UNDERSTAND                                                               │
│    Structured Fact Store Aggregation, Digital Maturity Analysis, Grok AI    │
│    Interpretation Layer                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. DECIDE                                                                   │
│    Deterministic Opportunity Engine, OneFolk Agency Service Catalog Mapping,│
│    Client Priority Matrix (HIGH / MEDIUM / LOW)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
Onefolk-Client-Intelligence/
├── apps/
│   └── web/                         # Next.js 14 App Router, Tailwind CSS, TanStack Query, Zustand
├── backend/
│   └── api/                         # Rust Axum Web API, SSE Broadcaster, CORS, JSON Handlers
├── workers/
│   └── worker/                      # Tokio Background Worker consuming Redis Streams
├── crates/
│   ├── domain/                      # Shared entities, DTOs, enums, SearchFilters, Events
│   ├── database/                    # SQLx connection pool, repositories, PostgreSQL queries
│   ├── queue/                       # Redis Streams Job Queue with consumer groups & ACK
│   ├── events/                      # Redis Pub/Sub & Local Broadcast EventBus for SSE Streaming
│   ├── discovery/                   # Search Planner, Deterministic Multi-Query Generator
│   ├── providers/                   # Provider Plugin Trait, Registry & Live Public Registry Providers
│   ├── normalization/               # Name, Legal Suffix, Phone & URL Normalization Engine
│   ├── entity-resolution/           # Deterministic Entity Matching & Deduplication Engine
│   ├── opportunities/               # Opportunity Engine, Service Mapping, Priority Scorer
│   ├── crawler/                     # Level 1 HTTP Crawler with SSRF Protection
│   ├── contacts/                    # Public Contact Extractor with Provenance
│   ├── social/                      # Social Profile discovery
│   ├── reviews/                     # Review Aggregation & Sentiment Evidence
│   ├── technology/                  # CMS, Analytics, Framework & Booking Fingerprinting
│   ├── intelligence/                # Structured Fact Store & Grok AI Client Interface
│   └── enrichment/                  # Multi-stage Enrichment Coordinator
├── infrastructure/
│   ├── docker/                      # Dockerfiles for API, Worker, and Web
│   ├── postgres/                    # init.sql database schema with optimized indexes
│   └── redis/                       # Redis persistence configuration
├── docker-compose.yml               # Local-first single-command orchestration
├── Cargo.toml                       # Root Cargo workspace
├── package.json                     # Bun workspace root
└── .env.example                     # Environment variable definitions
```

---

## ⚡ Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS | High-performance, rich dark theme UI |
| **Data Fetching & State** | TanStack Query, Zustand | Optimistic updates & state synchronization |
| **Realtime Stream** | Server-Sent Events (SSE) | Unidirectional, reconnecting, HTTP/2 native |
| **Backend API** | Rust (Axum, Tokio, Serde, SQLx) | Ultra-fast, zero-cost abstractions, safe concurrency |
| **Background Worker** | Rust (Tokio, Redis Streams) | Asynchronous non-blocking job execution |
| **Database** | PostgreSQL 16 | Relational master store with B-Tree & GIN indexes |
| **Queue & Cache** | Redis 7 + Redis Streams | Consumer groups, at-least-once delivery, event pub/sub |
| **Package Tooling** | Bun (JavaScript/TypeScript) | Lightning-fast dependency management |
| **Containerization** | Docker & Docker Compose | 100% reproducible local-first execution |

---

## 🚀 Running Locally

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Bun](https://bun.sh/) (for frontend)
- [Rust](https://www.rust-lang.org/) (for native backend development, optional with Docker)

### 1. Configure Environment

```bash
cp .env.example .env
```

### 2. Launch with Docker Compose (Recommended)

```bash
docker compose up --build
```

Services will start:
- **Next.js Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Rust Axum API**: [http://localhost:8000](http://localhost:8000)
- **PostgreSQL**: `localhost:5432` (`onefolk_intelligence`)
- **Redis**: `localhost:6379`

---

## 📡 API Endpoints

### Discovery & Searches
- `POST /api/searches` - Create Search Session, invoke Search Planner, and enqueue Redis Job.
- `GET  /api/searches` - List historical search sessions.
- `GET  /api/searches/:id` - Fetch search session stats and status.
- `GET  /api/searches/:id/events` - **Server-Sent Events (SSE)** real-time stream of discovery progress.
- `POST /api/searches/:id/cancel` - Cancel active search session.

### Businesses & Intelligence
- `GET  /api/businesses` - Query master businesses with filters (`industry`, `city`, `priority`).
- `GET  /api/businesses/:id` - Get full 9-tab business intelligence profile.
- `POST /api/businesses/:id/enrich` - Trigger on-demand progressive enrichment.

### Opportunities & Timeline
- `GET  /api/opportunities` - Get prioritized agency opportunity matrix.
- `GET  /api/activities` - Provenance and activity timeline stream.

---

## 🔄 End-to-End Discovery Pipeline Flow

```
User triggers search on /discover
       ↓
Next.js POST /api/searches
       ↓
Axum API creates Search Session in PostgreSQL (status = PENDING)
       ↓
Axum API enqueues job to Redis Stream 'onefolk:jobs:discovery'
       ↓
Axum API returns search_id to Frontend
       ↓
Next.js establishes SSE connection: GET /api/searches/:id/events
       ↓
Rust Background Worker reads job from Redis Stream
       ↓
Search Planner generates deterministic multi-query strategies
       ↓
Mock Discovery Provider executes query variations
       ↓
Normalization Engine sanitizes names, URLs, domains, phones
       ↓
Entity Resolution matches or creates Master Business in PostgreSQL
       ↓
Raw source records saved with 100% provenance
       ↓
Opportunity Engine detects service opportunities & calculates Priority Score
       ↓
Worker publishes SystemEvents to Redis EventBus
       ↓
SSE pushes real-time events to Next.js without page reload!
```
