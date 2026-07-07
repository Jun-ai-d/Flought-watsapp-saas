# WhatsApp AI SaaS Platform

A multi-tenant, high-performance SaaS platform that empowers businesses to automate their customer support on WhatsApp using AI (RAG) with seamless human agent handovers. 

This repository contains the complete monolithic codebase (Frontend + Backend) for the SaaS, built with modern, aggressive performance optimizations and strict tenant data isolation.

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
- **Routing:** React Router DOM (v6).
- **Performance:** Implements aggressive route-based code splitting using `React.lazy()` and `<Suspense>`. Users only download the specific JavaScript bundle for the page they are viewing, drastically reducing initial load times.
- **Styling (Pro Max UI):** 
  - **Tailwind CSS v4:** The entire CSS architecture uses the highly-performant Tailwind v4 engine, resulting in a zero-runtime-overhead styling solution.
  - **Radix UI:** Headless UI primitives (Dialogs, Dropdowns) are used for accessible, unstyled interactive components.
  - **Design Language:** Clean, premium aesthetic featuring dark mode glassmorphism, dynamic gradients, and the official Flought brand identity.
- **3D Marketing Pipeline:** The landing page utilizes `@react-three/fiber` and `@react-three/rapier` for a real-time physics simulation, visualizing the automated AI-to-Human Handover pipeline in a beautiful, performant 3D canvas.
- **Meta Compliance:** All legal documentation (Privacy Policy, Terms of Service, Data Deletion) is fully implemented and explicitly formatted to meet Meta's rigorous Business Solution Provider (BSP) dashboard requirements.

### Backend & Database
- **Database:** PostgreSQL (via Supabase).
- **Auth:** Supabase Auth with Row Level Security (RLS) guaranteeing strict multi-tenant isolation.
- **API:** Node.js / Express backend handles secure routes (tenant provisioning, WhatsApp Webhook ingestion, outbound BSP API calls).
- **Security:** Strict payload validation enforces enum constraints (`region`, `tier`) and string lengths before inserting records into Postgres.

### AI & RAG Pipeline
- **Models:** Claude Haiku for RAG generation, Whisper for voice-note STT.
- **Vector Database:** Supabase `pgvector`.
- **Retrieval Optimization:** We utilize a custom Postgres RPC function (`match_knowledge_chunks`) to execute K-Nearest Neighbor (KNN) vector similarity searches natively in the database using the `<=>` operator. This prevents Node.js memory leaks and ensures lightning-fast RAG retrieval as knowledge bases scale.

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
├── ARCHITECTURE.md       # Deep-dive into data flow and RLS
├── SITEMAP.md            # Map of all frontend and backend routes
├── PLAN.md               # Living implementation roadmap
└── README.md             # 👈 You are here
```

---

## 🔐 Multi-Tenancy & Security
Because this is a SaaS application, a single Postgres database holds data for multiple different businesses. We strictly enforce isolation using **Postgres Row Level Security (RLS)**.

Every table has an RLS policy that essentially says:
> *You can only SELECT/INSERT/UPDATE this row if the `tenant_id` matches the business you are authenticated with.*

There is also a strict **Platform Admin** bypass, allowing SaaS owners to log into a hidden dashboard to provision new businesses and manage subscription tiers.

---

## 💬 The WhatsApp Loop
When a customer sends a WhatsApp message to a business using this SaaS:
1. **Webhook:** Gupshup/BSP POSTs to our Express backend.
2. **State Check:** We check Postgres to see if the conversation is `bot` or `handover_pending`.
3. **RAG:** If `bot`, we query `pgvector` for context.
4. **LLM:** We ask Claude to answer securely using strict JSON outputs.
5. **Action:** If the LLM has high confidence, it replies. If it has low confidence, it mutes the AI and alerts human agents on the React frontend via Supabase Realtime WebSockets.
