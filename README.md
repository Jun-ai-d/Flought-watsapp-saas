# WhatsApp AI SaaS Platform (Flought)

A highly scalable, multi-tenant SaaS platform that empowers businesses to automate their customer support on WhatsApp using an enterprise-grade AI (RAG) engine, featuring seamless human-agent handovers.

This repository contains the complete monolithic codebase (Frontend + Backend) for the SaaS, built with modern, aggressive performance optimizations and strict tenant data isolation.

---

## ✨ SaaS Platform Features

Designed for Business Solution Providers (BSPs) to offer white-labeled WhatsApp AI support to thousands of businesses simultaneously.

### 🏢 Multi-Tenancy & Security
*   **Row Level Security (RLS):** Every Postgres table is strictly locked down. A business (tenant) can only ever query, read, or modify their own customers' data.
*   **Platform Admin Dashboard:** A hidden super-admin panel allows the SaaS owner to provision new tenants, monitor global usage, and enforce subscription tiers.
*   **Tier Enforcement:** Built-in quota limits per subscription tier (e.g., Free, Pro, Enterprise). If a tenant runs out of AI credits, the system gracefully falls back to Human Only mode until they upgrade.
*   **Meta BSP Compliance:** Fully compliant with Meta's strict WhatsApp API guidelines, including built-in Data Deletion callbacks, Terms of Service, Privacy Policies, and opt-out flows.

### 👥 Human-Agent Collaboration Inbox
*   **Real-time WebSockets:** The React frontend uses Supabase Realtime to stream incoming WhatsApp messages to human agents instantly.
*   **Agent Presence & Claiming:** Multiple agents can work in the same inbox. A "Claim" system prevents two agents from replying to the same customer.
*   **Optimistic UI:** When an agent sends a message, it appears instantly in the UI with a "Pending" tick, updating to "Delivered" or "Read" based on WhatsApp webhook receipts.

---

## 🧠 The "Ultimate RAG" Engine

This platform goes beyond naive vector search. It features an advanced, heavily optimized AI pipeline designed to minimize LLM token costs while maximizing response accuracy.

### 1. Adaptive Agent Router (`gpt-4o-mini`)
Instead of blindly running expensive RAG pipelines for every message, an ultra-fast routing model classifies incoming messages:
*   **Conversational:** Instantly replies to "Hello", "Thanks", or "Goodbye" without searching the database.
*   **Actionable:** Recognizes requests like "Cancel my order" and triggers specific workflows or hands the conversation over to a human.
*   **Knowledge:** Routes complex questions to the RAG pipeline.
*   **Split-Intent Handling:** If a user says *"Cancel my order AND what are your hours?"*, the router detects an array of intents and processes both simultaneously.

### 2. Zero-Latency Semantic Caching
To drastically reduce OpenAI API costs, we built a Semantic Cache using `pgvector` (`hnsw` index):
*   When a user asks a question, the system vectorizes it and checks the cache.
*   If anyone asked a highly similar question recently (Cosine Similarity > 0.95), the bot instantly returns the cached AI response, costing **zero** LLM generation tokens.
*   **Cross-Lingual Support:** The Agent Router automatically translates inbound questions to English in the background, ensuring a Spanish question and an Arabic question both successfully hit the same English cached response.
*   **Poisoning Prevention:** All AI responses run through OpenAI's `moderations` API before caching, ensuring hackers cannot inject malicious responses into the shared semantic cache.

### 3. Auto-FAQ Miner (Self-Learning)
The bot gets smarter over time automatically.
*   A nightly cron job (`runAutoFaqMiner`) scans the last 7 days of chat logs across all tenants.
*   It identifies high-frequency questions (asked 3+ times).
*   It uses the LLM to generate the perfect, canonical answer and saves it to the database as a `Draft`.
*   Tenant Admins click "Approve" in their dashboard, instantly upgrading it to a hardcoded FAQ, completely bypassing expensive RAG generation for future identical queries while preventing AI hallucination loops.

### 4. Hybrid Search (Vector + BM25)
Standard Vector Search is bad at finding exact product numbers (SKUs) or order IDs. 
*   We use a custom Postgres RPC to perform **Reciprocal Rank Fusion (RRF)**.
*   It combines `pgvector` semantic meaning with `BM25` exact-keyword matching.
*   **Typo Blindness Fix:** The router automatically strips hyphens and spaces from product codes (e.g., `SKU-123` -> `sku123`) to ensure BM25 always finds the right document.

---

## 🚀 Quick Start (Development)

```bash
# Install dependencies
npm install

# Start the Vite development server (Frontend)
npm run dev

# Start the Express backend (in a separate terminal)
cd backend && npm install && npm run dev
```

---

## 🏗 Architecture & Tech Stack

This SaaS is built on a highly optimized, modern tech stack designed for speed, scalability, and an Apple-tier "Pro Max" user experience.

### Frontend
- **Framework:** React 18 powered by Vite.
- **Routing:** React Router DOM (v6) with aggressive `<Suspense>` lazy-loading.
- **Styling (Pro Max UI):** Tailwind CSS v4 + Radix UI primitives. Clean, premium aesthetic featuring dark mode glassmorphism, dynamic gradients, and the official Flought brand identity.
- **3D Marketing Pipeline:** The landing page utilizes `@react-three/fiber` and `@react-three/rapier` for a real-time physics simulation of the AI-to-Human Handover pipeline.

### Backend & Database
- **Database:** PostgreSQL (via Supabase).
- **API:** Node.js / Express backend handles secure routes (tenant provisioning, WhatsApp Webhook ingestion, outbound BSP API calls).
- **Concurrency Control:** Utilizes strict PostgreSQL Row Locks (`FOR UPDATE`) and Optimistic Concurrency Control (OCC) to prevent duplicate webhook processing and race conditions.

---

## 📁 Project Structure

```text
d:\Watsapp saas\
├── Doc/                  # Source-of-truth specification documents
├── src/                  # React Frontend Source Code
│   ├── components/       # Reusable React components (Layout, Auth)
│   ├── contexts/         # React Context (AuthContext)
│   ├── lib/              # Utilities (supabase client, tailwind merge)
│   └── pages/            # Lazy-loaded route views
├── backend/              # Express server and backend services
│   ├── src/routes/       # API Controllers (webhooks, admin, outbound)
│   └── src/services/     # RAG, LLM, and BSP abstraction layer
├── supabase/             # Supabase config and SQL migrations
└── README.md             # 👈 You are here
```
