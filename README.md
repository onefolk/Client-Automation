# ONEFOLK CLIENT INTELLIGENCE (v2.6)

> **Autonomous AI-Powered Client Discovery, Opportunity Qualification & Agency Intelligence Platform**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Rust](https://img.shields.io/badge/Rust-Axum%20%2B%20Tokio-orange?style=flat&logo=rust)](https://www.rust-lang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7%20Streams-red?style=flat&logo=redis)](https://redis.io/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat&logo=vercel)](https://client-automation-web.vercel.app)
[![Railway](https://img.shields.io/badge/Deployed-Railway-darkpurple?style=flat&logo=railway)](https://client-automation-production.up.railway.app)

OneFolk Client Intelligence is an enterprise-grade platform designed for modern digital agencies, consultants, and growth teams to autonomously discover high-value prospective clients across any global industry, verify their real-time public digital footprint, detect critical operational and tech stack gaps (e.g. missing SEO schema, absent booking systems, slow mobile Core Web Vitals, weak lead capture), and deterministically qualify high-ticket agency service opportunities with actionable outreach pitches and ROI projections.

---

## 🌟 Key Capabilities & Highlights

### 🎯 1. Universal Intent-Driven Discovery
* **Linguistic Query Decomposition**: Automatically isolates the **Target Entity** (e.g. *Ecommerce Brands*, *Schools*, *Clinics*, *Law Firms*, *Real Estate Agencies*) from **Opportunity/Problem Qualifiers** (e.g. *poor SEO*, *needing ERP*, *without booking*, *lacking CRM*).
* **Multi-Provider Real-Time Ingestion**:
  * **OpenStreetMap Global Registry**: Direct municipal location and geographic coordinates.
  * **Live Web Organic Search Index**: Real-time domain verification and crawl discovery.
  * **Reddit Community Recommendations**: Organic social recommendations and niche mentions.
  * **Threads (@Meta) Brand Index**: Active brand handles and social footprints.
* **Sub-Second Streaming Execution**: Live streaming of discovery progress directly to the browser via **Server-Sent Events (SSE)** with zero hangs or timeouts.

### 💾 2. Persistent Client History (`/clientHistory`)
* **Deduplicated Entity Retention**: Automatically records all discovered businesses across search sessions.
* **Smart Collision Resolution**: Deduplicates candidates by `id`, `domain`, or `name + city` so repeated entities are updated rather than duplicated.
* **Session State Preservation**: When navigating to inspect a prospective client in Deep Intelligence and returning, the search state is preserved seamlessly.
* **Exportable Intelligence**: Export all discovered entities with contact info, priority scores, and timestamps directly to CSV.

### 🔬 3. Deep Intelligence & Digital Audit (`/businesses/:id`)
* **Level 1 Live HTTP Crawler**: Real-time DOM inspection extracting SSL status, load time (ms), mobile responsiveness, and email/phone endpoints.
* **Tech Stack Fingerprinting**: Detects CMS platforms (Shopify Plus, WordPress, Webflow, Wix), frameworks (Next.js, React), analytics (GA4, Meta CAPI, Hotjar), and booking/chat engines (OpenTable, SevenRooms, Calendly, WhatsApp).
* **Fact Store & Source Provenance**: 100% audit log tracking the provenance, timestamp, and confidence of every extracted signal.
* **Grok AI SWOT & Maturity Scoring**: Comprehensive digital maturity scoring across Digital Presence, Website UX, Social Footprint, Technical SEO, Lead Capture, and Reputation.
* **High-Converting Outreach Pitch Generator**: Generates customized, personalized cold email and LinkedIn outreach pitches tailored specifically to the detected tech gaps.
* **ROI Economics Calculator**: Dynamic revenue lift and lost revenue recovery projections tailored to the prospective client's industry and scale.

---

## 🏛️ System Architecture

The platform is designed as a **modular-monolith** in Rust with a modern Next.js 14 frontend, supporting both standalone serverless execution on Vercel and full distributed orchestration on Railway (PostgreSQL + Redis Streams + Tokio background workers):

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             1. INTENT & PLANNING                                 │
│  User Natural Language Query → NLP Intent Decomposition → Multi-Query Strategy   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                             2. INGESTION & CRAWL                                 │
│  OpenStreetMap + Web Search + Reddit + Threads → Level 1 HTTP Crawler & DOM Audit│
├──────────────────────────────────────────────────────────────────────────────────┤
│                             3. NORMALIZATION & RESOLUTION                        │
│  Suffix Stripping + Phone/URL Normalization → Deterministic Entity Resolution    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                             4. SCORING & QUALIFICATION                           │
│  Signal Matching → OneFolk Service Catalog Mapping → Priority Scorer (HIGH/MED) │
├──────────────────────────────────────────────────────────────────────────────────┤
│                             5. REAL-TIME STREAMING & SSE                         │
│  Events Streamed to Client → Instant Business & Opportunity Cards Rendered       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
Onefolk-Client-Intelligence/
├── apps/
│   └── web/                         # Next.js 14 App Router Frontend & Serverless Edge Handlers
│       ├── src/
│       │   ├── app/                 # Discover, Client History, Directory, Matrix, Settings
│       │   │   ├── api/             # API routes (searches, businesses, intent, config, SSE)
│       │   │   ├── businesses/      # Master Directory & Deep Intelligence Profile pages
│       │   │   ├── clientHistory/   # Discovered Client History Dashboard
│       │   │   └── discover/        # Live Universal Client Discovery Command Bar
│       │   ├── components/          # Sidebar, Header, Metrics, Status Badges
│       │   └── lib/                 # Types, SSE hook, Discovery Engine, Intent Parser, Store
│       └── package.json
├── backend/
│   └── api/                         # Rust Axum Web API, SSE Broadcaster, CORS, JSON Handlers
├── workers/
│   └── worker/                      # Tokio Background Worker consuming Redis Streams
├── crates/
│   ├── domain/                      # Shared entities, DTOs, enums, SearchFilters, Events
│   ├── database/                    # SQLx connection pool, repositories, PostgreSQL queries
│   ├── queue/                       # Redis Streams Job Queue with consumer groups & ACK
│   ├── events/                      # Redis Pub/Sub & Local Broadcast EventBus for SSE
│   ├── discovery/                   # Universal Intent Engine & Search Planner
│   ├── providers/                   # Multi-Provider Plugin Trait & Live Registry Fetchers
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
│   ├── docker/                      # Production Dockerfiles (API, Worker, Web)
│   ├── postgres/                    # init.sql database schema with optimized indexes
│   └── redis/                       # Redis persistence configuration
├── docker-compose.yml               # Local-first single-command orchestration
├── Cargo.toml                       # Root Cargo workspace
└── package.json                     # Monorepo root
```

---

## ⚡ Tech Stack & Tooling

| Component | Technology | Description |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router) | High-performance React framework with TypeScript |
| **Styling & Design** | Tailwind CSS + Lucide Icons | Premium Dark-mode Agency Cyberpunk Theme |
| **State & Cache** | TanStack Query v5 + Zustand | Optimistic updates, cache invalidation, and reactivity |
| **Realtime Stream** | Server-Sent Events (SSE) | Sub-second unidirectional live event streaming |
| **Backend API** | Rust (Axum, Tokio, SQLx) | Zero-cost abstractions, memory-safe high-throughput API |
| **Background Processing**| Rust Tokio + Redis Streams | Asynchronous job queues with at-least-once delivery |
| **Primary Database** | PostgreSQL 16 | Relational master store with B-Tree & GIN indexes |
| **Queue & Event Bus** | Redis 7 | Distributed consumer groups and event pub/sub |
| **Deployment** | Vercel (Web) + Railway (API/DB) | Production cloud infrastructure with automatic CI/CD |

---

## 📡 API Reference

### 🏢 Businesses & Client History
| Endpoint | Method | Description |
|---|---|---|
| `/api/businesses` | `GET` | List all discovered master businesses (filter by `priority`, `industry`, `city`) |
| `/api/clientHistory` | `GET` | Retrieve deduplicated client history list |
| `/api/businesses/:id` | `GET` | Full verified intelligence profile (contacts, tech, facts, SWOT, opportunities) |
| `/api/businesses/:id/enrich` | `POST` | Trigger Level 1 technical crawl & contact enrichment |
| `/api/businesses/:id/analyze` | `POST` | Trigger Grok AI SWOT analysis, scores, and outreach pitch generation |

### 🔍 Discovery & Searches
| Endpoint | Method | Description |
|---|---|---|
| `/api/searches` | `POST` | Launch multi-provider client discovery pipeline |
| `/api/searches` | `GET` | List all historical search sessions and metrics |
| `/api/searches/:id` | `GET` | Get search session details and progress |
| `/api/searches/:id/events` | `GET` | **Server-Sent Events (SSE)** real-time live discovery stream |
| `/api/searches/:id/cancel` | `POST` | Cancel active search job |

### 🧠 Intent & Service Registry
| Endpoint | Method | Description |
|---|---|---|
| `/api/intent/parse` | `POST` | NLP intent decomposition (extracts entity, opportunity, location, conditions) |
| `/api/config/services` | `GET` | List OneFolk high-ticket service catalog definitions |
| `/api/config/opportunities`| `GET` | List opportunity qualification rule definitions |
| `/api/config/resources` | `GET` | List discovery provider definitions |
| `/api/opportunities` | `GET` | List all detected client opportunities |
| `/api/activities` | `GET` | Provenance activity stream / timeline audit logs |
| `/api/health` | `GET` | Health check endpoint |

---

## 🚀 Getting Started Locally

### Prerequisites
* [Node.js 18+](https://nodejs.org/) & [npm](https://npmjs.com/)
* [Docker](https://www.docker.com/) & Docker Compose (Optional for full backend stack)
* [Rust Toolchain](https://www.rust-lang.org/) (Optional for native backend development)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/onefolk/Client-Automation.git
cd Client-Automation

# Install web frontend dependencies
cd apps/web
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the project root:
```env
# Database & Cache (for Docker / Native Rust)
DATABASE_URL=postgres://onefolk:onefolk_secret_dev@localhost:5432/onefolk_intelligence
REDIS_URL=redis://localhost:6379

# Web Frontend (Optional: point to local or cloud Rust API)
NEXT_PUBLIC_API_URL=
```

### 3. Launch Frontend
```bash
cd apps/web
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the OneFolk Client Intelligence dashboard.

### 4. Launch Full Stack with Docker Compose (Optional)
```bash
docker compose up --build
```
* **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
* **Rust Axum API**: [http://localhost:8000](http://localhost:8000)
* **PostgreSQL**: `localhost:5432` (`onefolk_intelligence`)
* **Redis**: `localhost:6379`

---

## 🌐 Production Deployments

* **Frontend (Vercel)**: [`https://client-automation-web.vercel.app`](https://client-automation-web.vercel.app)
* **Backend API (Railway)**: [`https://client-automation-production.up.railway.app`](https://client-automation-production.up.railway.app)

---

## 📄 License

Proprietary © 2026 OneFolk Agency Intelligence. All rights reserved.
