# Flought — Changelog

> Dated, terse log of actual changes shipped. Scan this to answer "what changed since last week."

---

## 2026-07-04

- **[DOCS]** Created project documentation system: `PLAN.md`, `SESSION.md`, `CHANGELOG.md`, `README.md`, `DECISIONS.md`
- **[PLAN]** Produced full 11-phase implementation plan (Phases 0–10) with sub-phase breakdowns, dependencies, governing docs, and acceptance criteria
- **[PLAN]** Identified and documented 6 gaps/conflicts between source documents
- **[PLAN]** Logged 7 open questions requiring resolution before their respective phases
- **[TECH]** Initialized Vite + React + TypeScript project (Phase 0.1)
- **[DOCS]** Restored all source and living documentation after accidental deletion by Vite template scaffolding
- **[TECH]** Completed Phase 0: Scaffolded design system with CSS tokens, base component styles (stamps, ledger list), and a /showcase page.
- **[TECH]** Completed Phase 1: Implemented App Shell layout, public Landing Page, and all dashboard views (Inbox, FAQs, Knowledge Base, Templates, Billing, Settings, Login) with static mock data.
- **[TECH]** Completed Phase 2: Created Supabase config, SQL migrations (001 to 006), and generated local `src/types/supabase.ts`. Database schema applied manually in the cloud dashboard.

## 2026-07-05
- **[TECH]** **Code Quality Phase:** Eliminated backend `any` types in `admin.ts` by explicitly extending the Express Request interface. Migrated all frontend hardcoded local API strings to `import.meta.env.VITE_API_URL`.
- **[TECH]** **Performance Phase:** Overhauled frontend routing in `App.tsx` to use lazy loading (`React.lazy`) and `<Suspense>`, enabling aggressive route-based code splitting.
- **[TECH]** **Security Phase:** Injected strict payload validation (enum checking, string validation) into the backend `POST /tenants` provisioning route.
- **[TECH]** **AI & RAG Upgrade:** Completely refactored the RAG pipeline (`backend/src/services/kb/retrieval.ts`) to leverage Supabase Postgres RPC (`match_knowledge_chunks`) for native `pgvector` KNN matching instead of doing similarity math in Node.js memory.
- **[TECH]** **UI Pro Max Upgrade:** Integrated Tailwind CSS v4 and Radix UI. Completely rewrote `Layout.tsx`, `Dashboard.tsx`, `Inbox.tsx`, and `AdminDashboard.tsx` to use optimized utility classes. Deleted all legacy `.css` files.
- **[DOCS]** Comprehensively updated `README.md` and `DECISIONS.md` to reflect the new UI and Database architecture.
