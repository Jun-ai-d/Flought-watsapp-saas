# Flought

**WhatsApp Business automation for Indian SMBs** — an agency-delivered platform that lets Flought onboard a client's WhatsApp number, configure a business-scoped bot (FAQ-first, RAG fallback) with reliable human handover, and bill them monthly. Not a self-serve SaaS competing horizontally; Flought is the agency, the platform is the delivery mechanism.

---

## 🚀 Quick Start (Development)

```bash
# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

---

## 🏗 Architecture & Tech Stack

Flought is built on a highly optimized, modern tech stack designed for speed, scalability, and an Apple-tier "Pro Max" user experience.

### Frontend
- **Framework:** React 18 powered by Vite.
- **Routing:** React Router DOM (v6).
- **Performance:** Implements aggressive route-based code splitting using `React.lazy()` and `<Suspense>`. Users only download the specific Javascript bundle for the page they are viewing, drastically reducing initial load times.
- **Styling (Pro Max UI):** 
  - **Tailwind CSS v4:** The entire CSS architecture was migrated from raw Vanilla CSS to the highly-performant Tailwind v4 engine, resulting in a zero-runtime-overhead styling solution.
  - **Radix UI:** Headless UI primitives (Dialogs, Dropdowns) are used for accessible, unstyled interactive components.
  - **Design Language:** Clean, brutalist layout featuring stark contrasting borders, flat colors, and mono-spaced fonts (`Courier Prime`) mixed with modern sans-serif (`Inter`, `Space Grotesk`).

### Backend & Database
- **Database:** PostgreSQL (via Supabase).
- **Auth:** Supabase Auth with Row Level Security (RLS) guaranteeing strict tenant isolation.
- **API:** Node.js / Express backend handles secure routes (tenant provisioning, WhatsApp Webhook ingestion, out-bound Gupshup/BSP API calls).
- **Security:** Strict payload validation enforces enum constraints (`region`, `tier`) and string lengths before inserting records into Postgres.

### AI & RAG Pipeline
- **Models:** Claude Haiku for RAG generation, Whisper for voice-note STT.
- **Vector Database:** Supabase `pgvector`.
- **Retrieval Optimization:** We utilize a custom Postgres RPC function (`match_knowledge_chunks`) to execute K-Nearest Neighbor (KNN) vector similarity searches natively in the database using the `<=>` operator. This prevents Node.js memory leaks and ensures lightning-fast RAG retrieval as knowledge bases scale.

---

## 📁 Project Structure

```
d:\Watsapp saas\
├── Doc/                    # Source-of-truth specification documents
├── src/                    # React Frontend Source Code
│   ├── components/         # Reusable React components (Layout, Auth)
│   ├── contexts/           # React Context (AuthContext)
│   ├── lib/                # Utilities (supabase client, tailwind merge)
│   └── pages/              # Lazy-loaded route views
├── backend/                # Express server and backend services
│   ├── src/routes/         # API Controllers
│   └── src/services/       # RAG, LLM, and BSP abstraction layer
├── supabase/               # Supabase config and SQL migrations
├── PLAN.md                 # Living implementation roadmap
├── SESSION.md              # Running work-session log
├── CHANGELOG.md            # Terse log of shipped changes
├── DECISIONS.md            # Architecture & design decisions log
└── README.md               # 👈 You are here
```

---

## 📚 Living Documentation

These files are updated throughout the build, not written once and abandoned:

| File | Purpose | When to read |
|---|---|---|
| [PLAN.md](file:///d:/Watsapp%20saas/PLAN.md) | Full phase/sub-phase breakdown. Items marked done/in-progress/blocked. | Before starting any work session |
| [SESSION.md](file:///d:/Watsapp%20saas/SESSION.md) | What was attempted, built, broke, and left hanging. | When picking up after a gap |
| [CHANGELOG.md](file:///d:/Watsapp%20saas/CHANGELOG.md) | Dated log of shipped changes. | To answer "what changed since X?" |
| [DECISIONS.md](file:///d:/Watsapp%20saas/DECISIONS.md) | Architecture decisions with rationale. | When questioning why something was done a certain way |

---

## Source-of-Truth Documents
All product, technical, and legal specifications live in [`Doc/`](file:///d:/Watsapp%20saas/Doc). The **PRD** is the parent document — if any other document conflicts with it, the PRD wins; update the PRD first, then propagate.
