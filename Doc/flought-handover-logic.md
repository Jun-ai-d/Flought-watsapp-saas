# Flought — Human Handover & Conversation State Logic

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-TRD.md, flought-database-schema.md
**Purpose:** This is the one mechanic that differentiates Flought from a plain FAQ bot — full state machine, trigger conditions, and edge cases so it's built consistently, not improvised per session.

---

## 1. Conversation States

A conversation is always in exactly one state, stored in `conversations.status`:

| State | Meaning |
|---|---|
| `bot` | Bot is actively handling this conversation (FAQ or RAG) |
| `handover_pending` | A handover trigger fired; waiting for an agent to pick it up |
| `handover_active` | An agent has claimed the conversation; bot is silent |
| `resolved` | Conversation closed — either by agent action or auto-resolve timeout |

**Hard rule:** the bot must never send an automated reply while a conversation is in `handover_pending` or `handover_active`. This is the single most important invariant in the whole system — a bot reply landing on top of an agent's in-progress reply is the failure mode that breaks customer trust fastest.

---

## 2. State Transition Diagram

```
                    ┌─────────┐
      new message → │  bot    │
                    └────┬────┘
                         │
        ┌────────────────┼─────────────────┐
        │ trigger fires  │ no trigger       │ agent resolves
        ▼                ▼                  │ directly (rare)
┌─────────────────┐  (stays in bot,   ┌──────────┐
│ handover_pending │   bot replies)   │ resolved │
└────────┬─────────┘                  └──────────┘
         │ agent claims                    ▲
         ▼                                 │
┌─────────────────┐  agent marks resolved  │
│ handover_active  │────────────────────────┘
└────────┬─────────┘
         │ customer inactive 24h+ after last agent reply
         ▼
   auto-resolved (see §6)
```

---

## 3. Handover Trigger Conditions

A conversation moves from `bot` → `handover_pending` when **any** of these fire:

### 3.1 Explicit customer request
Customer message matches human-request intent (keyword/intent classification — "talk to someone," "human," "agent," "manager," or local-language equivalents including Hindi/Hinglish phrasing). This should be checked **before** the FAQ/RAG pipeline runs, not after — an explicit request should never be answered by the bot first.

### 3.2 Low retrieval/generation confidence
- RAG retrieval returns no chunks above a minimum relevance threshold, **or**
- The LLM's response indicates uncertainty (e.g., a self-reported low-confidence flag from a structured output, not just "the answer sounds unsure") — the pipeline should explicitly ask the model to signal confidence rather than inferring it from tone.
- No FAQ match **and** RAG retrieval also fails → straight to handover, never a generic "I don't understand" loop.

### 3.3 Compliance-sensitive topics
Per the PRD's hard compliance requirement (bot must stay scoped to the tenant's business), any query that drifts off-topic, or touches a sensitive category (medical diagnosis requests to a clinic bot, legal/financial advice, complaints/refund disputes) routes to a human rather than letting the LLM attempt an answer. This protects both the tenant's WhatsApp account standing and the end customer.

### 3.4 Repeated failure loop
If the same customer sends 2+ consecutive messages that each fail to resolve via FAQ/RAG (tracked via a per-conversation counter, reset on any successful bot resolution), force handover rather than letting the bot keep guessing. This prevents the "bot loop" experience that's a documented complaint pattern in this category.

### 3.5 Negative sentiment / frustration signal
Basic sentiment/frustration detection on inbound text (e.g., repeated punctuation, explicit frustration language) — not a hard requirement for v1, but flag as a fast-follow enhancement once the base handover logic is proven, since it's a softer signal that needs tuning against real conversation data rather than launching untested.

---

## 4. Handover Pending → Active (Claiming Logic)

- When a conversation enters `handover_pending`, it appears in the tenant's shared inbox, filterable/sortable by wait time.
- **First agent to open/claim it** transitions the conversation to `handover_active` and sets `assigned_agent_id`. This should be an atomic operation (a single UPDATE with a `WHERE status = 'handover_pending'` guard) to prevent two agents from simultaneously claiming the same conversation — a real race condition with multiple staff/agents, which per the PRD is your actual dashboard user base ("a mix of owners and staff/agents").
- If no agent claims within a configurable SLA window (e.g., 15–30 minutes, tenant-configurable later, hardcoded reasonable default at launch), escalate: notify the tenant admin directly (push notification / WhatsApp alert to the admin's own number) rather than leaving the customer waiting silently.

---

## 5. Handover Active → Resolved

Triggered by any of:
- Agent explicitly marks the conversation "Resolved" in the dashboard.
- Agent sends a reply and the customer doesn't respond for a defined period (see §6, auto-resolve) — treated as implicitly resolved, not abandoned.
- Agent explicitly hands the conversation **back to the bot** (a deliberate action, not automatic) — this should be rare and intentional, e.g., agent answers the one sensitive question and returns routine follow-up to automation.

**On resolve:** `service_window_expires_at` and conversation metadata remain intact for audit/history — resolved conversations are not deleted, they're archived in place (per the "duplicate copy" audit-trail principle already established in the design direction — every resolved conversation is itself a permanent record).

---

## 6. Auto-Resolve & Timeout Handling

- If a conversation sits in `handover_active` with no customer reply for 24 hours (aligned with WhatsApp's own service-window expiry), auto-transition to `resolved`. This keeps the inbox clean and prevents stale "active" conversations from cluttering agent views indefinitely.
- If a conversation sits in `handover_pending` unclaimed past a hard ceiling (e.g., 24 hours), auto-escalate to tenant admin with a distinct "unclaimed" flag — this is a service-quality failure worth surfacing loudly, not silently auto-resolving it as if it were handled.

---

## 7. What the Agent Sees (Dashboard Requirements)

- Full conversation history **including the bot's prior automated replies** — an agent picking up a handover needs the full context, not just the triggering message.
- The **reason** the handover fired (explicit request / low confidence / compliance flag / repeated failure) — surfaced as a small label, so the agent knows whether they're rescuing a confused bot or handling a topic the bot was correctly told to avoid.
- If RAG was involved before handover, show which knowledge chunks were retrieved (traceable via `messages.retrieved_chunk_ids`) — helps the agent spot gaps in the tenant's knowledge base, which feeds directly back into improving FAQs (per the PRD's "common unanswered queries" analytics requirement).

---

## 8. Multi-Agent Considerations (per confirmed dashboard audience: owners + staff)

- `tenant_users.role` distinguishes `admin` (owner, sees everything, gets escalation alerts) from `agent` (staff, sees the shared inbox, claims conversations).
- No hard requirement for agent-specific conversation assignment beyond claiming in v1 — round-robin or skill-based routing is an explicit non-goal until there's a tenant with enough agent volume to need it (premature complexity otherwise).
- Claimed conversations should still be visible to other agents/the admin (read access), just not claimable by them while active — visibility for oversight, exclusivity for action.

---

## 9. Edge Cases to Handle Explicitly

| Scenario | Required behavior |
|---|---|
| Customer sends a new message while conversation is in `handover_pending` | Message is appended to the conversation, does not reset/duplicate the pending state, does not trigger a second bot attempt |
| Customer sends a new message while `handover_active` | Message routes only to the assigned agent's view — bot stays silent |
| Agent goes offline mid-conversation | Conversation stays `handover_active`, visible to other agents/admin, who can manually reclaim it (reassign `assigned_agent_id`) — don't auto-return to bot without explicit action |
| Two webhook deliveries of the same inbound message (Meta's at-least-once delivery) | Deduplicated by `wa_message_id` before it ever reaches the state machine — handled at the ingestion layer per TRD §4.1, not here |
| Tenant has zero agents configured (solo owner) | Admin is treated as the only possible claimant — escalation notifications go to them directly with no separate "agent" tier |

---

## 10. Explicit Non-Goals (v1)

- No automated re-engagement messages to customers who went silent mid-handover (risks looking like unsolicited marketing, a compliance risk per the PRD).
- No AI-assisted "suggested reply" for agents during handover — agents type their own responses in v1; this is a plausible fast-follow, not a launch requirement.
- No cross-tenant agent pooling (a single agent working across multiple tenant inboxes) — each tenant's agents are scoped to that tenant only.

---

## 11. Traceability

Every trigger condition and state transition here must be reflected in the `conversations.status` check constraint and the Edge Function logic that processes inbound webhooks (TRD §4). If implementation needs a state or trigger not listed here, add it to this document first, then build it — don't let the state machine grow silently divergent from this spec.
