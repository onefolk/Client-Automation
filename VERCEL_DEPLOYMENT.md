# ▲ OneFolk Client Intelligence - Vercel Deployment Guide

This guide walks you through deploying the **OneFolk Client Intelligence Frontend** on [Vercel](https://vercel.com).

---

## 🚀 2-Minute Deployment Steps

### 1. Import Repository in Vercel
1. Go to **[Vercel Dashboard](https://vercel.com/new)**.
2. Click **"Import Project"** and select `https://github.com/onefolk/Client-Automation.git`.

### 2. Configure Project Settings
In the Vercel project configuration window:
- **Framework Preset**: `Next.js` (automatically detected)
- **Root Directory**: Click **Edit** and select `apps/web` (or leave default if using root `vercel.json`).
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3. Set Environment Variables (Optional)
If you are running the dedicated Rust Backend API on Railway:
```env
NEXT_PUBLIC_API_URL=https://your-backend-api.up.railway.app
```
*(If left empty, the frontend will use the built-in Next.js App Router API routes).*

### 4. Click "Deploy"
Vercel will build the frontend and provide your live URL (e.g. `https://onefolk-client-intelligence.vercel.app`).

---

## 🔗 Architecture Pairing (Vercel Frontend + Railway Backend)

```
       [ Client Browser ]
               │
               ▼
   ▲ [ Vercel Edge CDN ] (Frontend UI Dashboard)
               │ (REST API & SSE)
               ▼
   🚂 [ Railway Backend ] (PostgreSQL + Redis + Rust Axum API)
```
