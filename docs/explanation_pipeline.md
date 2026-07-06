# The Automation Pipeline: How It Works

**Document Type:** Explanation
**Target Audience:** Backend Developers & Product Managers
**Goal:** Provide an understanding-oriented discussion of how the intelligent message automation pipeline functions.

---

## The Core Concept: The Waterfall Approach

When an incoming WhatsApp message is received and saved to the database, it is immediately passed into the Automation Pipeline (`pipeline.ts`). The pipeline is designed to figure out how to respond to the user without human intervention. 

To achieve this, the system uses a **Waterfall Pattern**. It processes the message through a series of logical "gates" in a specific order. If any gate successfully handles the message, execution halts immediately, and the downstream gates are ignored.

This ensures that deterministic, fast rules take precedence over slower, AI-driven responses.

## The Pipeline Gates

### Gate 1: Human Handover Check
The very first thing the pipeline asks is: *"Is a human already talking to this user, or did the user just ask for a human?"*

1. **Active Handover:** If the `conversations` table shows `human_handover = true`, the bot stays silent. A human agent is manually handling the ticket in the dashboard.
2. **Intent Match:** If the message matches specific trigger phrases (e.g., "talk to agent", "human"), the system immediately flips `human_handover = true`, alerts the dashboard, and stops processing.

### Gate 2: Quota Enforcement
Before doing any heavy lifting, the pipeline checks the tenant's billing status.
Does the tenant have enough credits left on their current plan to send an AI response? If not, the pipeline halts to prevent the SaaS platform from incurring OpenAI/Vector costs for non-paying users.

### Gate 3: FAQ / Exact Match Routing
This is a deterministic, fast rule engine.
If a tenant has predefined exact-match Q&A pairs (e.g., "What are your hours?" -> "9 AM to 5 PM"), the system checks if the user's message matches the trigger phrase.
If it matches, the pre-written response is instantly dispatched via the BSP layer. This bypasses the need for an expensive LLM call.

### Gate 4: Visual Flow Matcher
*(If implemented)*: Checks if the user is currently navigating through a predefined decision-tree bot flow. If so, it processes their input (e.g., typing "1" for Sales, "2" for Support) and advances them to the next node in the flow.

### Gate 5: RAG & Generative AI (The Fallback)
If the message passes through all previous gates untouched, it reaches the final stage: **Retrieval-Augmented Generation (RAG)**.

1. **Embedding Generation:** The user's text message is sent to OpenAI's embedding model to convert it into a vector representation.
2. **Vector Search:** The vector is used to query the `knowledge_base_chunks` table using `pgvector` to find the most semantically similar pieces of information uploaded by the tenant.
3. **LLM Generation:** The retrieved context chunks and the user's message are bundled together and sent to an LLM (e.g., GPT-4o or Claude) with a system prompt instructing it to answer the question *only* using the provided context.
4. **Dispatch:** The generated response is sent back to the user via WhatsApp.

---

## Why this architecture matters

By structuring the automation as a strict waterfall:
1. **Costs are minimized:** We only call the LLM if exact matches fail.
2. **Control is maximized:** Tenants can override the AI with strict FAQ responses.
3. **Safety is ensured:** The bot immediately backs off the moment human intervention is detected.
