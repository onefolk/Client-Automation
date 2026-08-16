# 🚂 OneFolk Client Intelligence - Railway Deployment Guide

This guide walks you through deploying **OneFolk Client Intelligence** on [Railway](https://railway.app).

---

## ⚡ Option A: Quick Fullstack Web Deployment (Recommended, ~2 minutes)

The Next.js web application includes the complete fullstack runtime with embedded SSE streaming, live HTTP crawlers, multi-provider discovery, and Fact Store APIs.

### Steps:
1. Go to **[Railway.app](https://railway.app)** and click **"New Project"**.
2. Select **"Deploy from GitHub repo"**.
3. Choose your repository: `https://github.com/onefolk/Client-Automation.git`.
4. Railway will automatically detect `nixpacks.toml` or `railway.json` and build the application!
5. In **Project Settings** → **Domains**, click **"Generate Domain"** (e.g. `https://onefolk-production.up.railway.app`).
6. Open your generated domain to access the live dashboard!

---

## 🏛️ Option B: Complete Microservices Architecture on Railway

For enterprise production scaling with dedicated PostgreSQL, Redis, and Rust Backend API:

### 1. Add PostgreSQL Database
- In Railway, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**.
- Railway automatically provisions the database and sets the `DATABASE_URL` environment variable.

### 2. Add Redis Queue
- In Railway, click **"+ New"** → **"Database"** → **"Add Redis"**.
- Railway sets the `REDIS_URL` environment variable.

### 3. Deploy Rust Backend API (`onefolk-api`)
- Click **"+ New"** → **"GitHub Repo"** → Select `Client-Automation`.
- In **Settings** → **Build**, set Dockerfile path to: `Dockerfile`.
- Set Environment Variables:
  ```env
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  REDIS_URL=${{Redis.REDIS_URL}}
  PORT=8080
  RUST_LOG=info
  GROK_API_KEY=your_xai_api_key_here
  ```

### 4. Deploy Next.js Frontend Dashboard (`onefolk-web`)
- Click **"+ New"** → **"GitHub Repo"** → Select `Client-Automation`.
- In **Settings** → **Build**, set Dockerfile path to: `Dockerfile.web` (or let Nixpacks build it).
- Set Environment Variables:
  ```env
  NEXT_PUBLIC_API_URL=https://${{onefolk-api.RAILWAY_STATIC_URL}}
  PORT=3000
  NODE_ENV=production
  ```

---

## 🔑 Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Dynamic web port assigned by Railway | Auto-assigned by Railway |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/railway` |
| `REDIS_URL` | Redis Streams connection string | `redis://default:pass@host:6379` |
| `GROK_API_KEY` | Optional xAI API Key for Grok Intelligence | `xai-xxxxxxxxxxxx` |
| `NEXT_PUBLIC_API_URL` | REST API base URL for client fetch requests | Defaults to relative `/api` |

---

## 🩺 Health Check Endpoints
- **Web App**: `GET /` (HTTP 200)
- **Rust API**: `GET /health` (HTTP 200 `{"status":"ok"}`)
