# Flought — Brand & Design Guidelines

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-TRD.md
**Status:** Finalized direction, pending visual test-render in Lovable. This document is the single source of truth for Flought's visual identity — if a build decision conflicts with this, this document wins; update it here first, then propagate to the build.
**Design direction selected:** "Duplicate Copy" (refined v2 — superseded an earlier "Ledger" v1 concept that was explicitly rejected as too literal/costume-like; see §7 for what was dropped and why).

---

## 1. The Concept

Every Indian shopkeeper's bill book works the same way: write once, a carbon sheet underneath produces a faint duplicate — one copy to the customer, one stays in the book as the permanent record.

This is not a decorative theme — it's a literal structural match to what Flought does: **every WhatsApp conversation is the "original" the customer sees, and the compliance/audit log is the "duplicate" the business keeps.** Every visual choice below should trace back to encoding this real distinction, not just decorating the UI with "Indian ledger" flavor for its own sake. That discipline is what separates this from a themed skin.

**Primary design goal:** must not look AI-generated or generically SaaS-templated. Avoid the shared visual language of WhatsApp SaaS incumbents (Wati, AiSensy, Interakt all default to green-tinted bubbles and rounded cards) and avoid stock 3D shapes, gradient blobs, and stock illustration.

---

## 2. Color Palette (locked — no substitutions)

| Role | Hex | Use | Do NOT use for |
|---|---|---|---|
| **Background — bill-paper cream** | `#F5F0E6` | Page/app background, card surfaces. Flat — no grain, texture, or paper-aging filter. | Never as a text color |
| **Primary — carbon-ink indigo** | `#1A1F3C` | Primary text, headers, nav — reads as "ink," not as a navy brand color | Not as a large decorative fill |
| **Accent — rubber-stamp red** | `#C1440E` | The **one** saturated accent. Status stamps, primary CTAs, the single margin rule. | Never decoratively, never as a background fill or block, never repeated as a pattern |
| **Secondary — carbon-smudge gray** | `#8B8378` | Reserved **specifically** for audit-trail/compliance UI — the "duplicate copy" record, distinct from what the customer saw | Not generic muted/disabled text elsewhere — that dilutes its meaning |

**Explicitly dropped from the earlier v1 direction:** a sage-green "resolved" color and a broader multi-color status system. One accent (stamp red) carries all status weight now — diluting it across multiple colors was identified as weakening the signature element.

---

## 3. Typography

- **Record/display face:** a typewriter-influenced slab serif. Used **only** for things that represent a written record: conversation serial numbers, invoice-style IDs, timestamps. Do not use it for general headings — restricting it to "recorded" content is what keeps it purposeful rather than twee.
- **Body/UI face:** a clean grotesque sans-serif for everything else — navigation, buttons, paragraph copy, general dashboard UI.

---

## 4. Signature Structural Elements (information-bearing, not decorative)

These are the elements that make this a design *system* rather than a costume — each one encodes something real about the product:

1. **Serial numbers as invoice numbers** — every conversation gets a human-facing serial number styled in the typewriter slab face (e.g., `No. 00482`), because functionally it is an invoice/record number. This ties directly to `conversations.serial_number` in the database schema.
2. **The carbon-smudge gray marks the audit trail specifically** — anywhere the UI shows "what the system logged" (retrieved RAG chunks, handover trigger reason, bot confidence) versus "what the customer actually saw," the gray secondary color is the visual signal of that distinction. This is a real functional split in the product (per `flought-handover-logic.md` §7 — agents need to see *why* a handover fired), not an arbitrary color choice.
3. **Stamp-style status badges, red only** — `RESOLVED` / `HANDOVER` / `PENDING` render as rubber-stamp-style marks in `#C1440E`. No other status colors exist. This maps directly to `conversations.status` in the schema.
4. **A single red vertical margin rule** — the literal margin line from real ledger paper, used once (e.g., left edge of the landing page, or anchoring a conversation thread), never repeated as a tiled or decorative pattern.

---

## 5. Layout Principles

- **Dashboard conversation list:** rendered as ledger line-items/rows — not rounded chat-bubble cards. Each row: serial number (slab face, left-aligned) → customer name/phone (grotesque sans) → stamp-style status badge (red only) → a muted gray secondary line for the audit/compliance snippet.
- **Landing page hero:** split layout. One side shows a real-looking WhatsApp thread resolving live (a stamp-style "AUTO-RESOLVED" mark stamping down in red as the bot answers). Other side: plain, confident headline copy — no stock illustration, no 3D shapes, no gradients.
- **Flat surfaces throughout** — no rounded pill buttons, no soft drop shadows, no gradients anywhere. This is a deliberate rejection of default "friendly SaaS" visual tropes.
- **Mobile:** stack the hero split vertically; keep the margin rule on the conversation thread only, not the full page.

---

## 6. Tone of Voice (bot replies are the brand)

Since the bot's replies are the actual point of contact with tenants' customers, tone must match the visual restraint:
- Business-like, receipt-terse, procedural — e.g. "Confirmed. Appointment: Tue 10 AM." rather than "Yay! You're all set! 🎉"
- No forced friendliness or exclamation-heavy copy. The brand should feel *reliable and procedural*, not bubbly or consumer-facing — consistent with the "duplicate copy record" concept, not a chatty assistant persona.

---

## 7. What Was Considered and Rejected

For traceability, since two directions were explored before this one was finalized:

- **"Ledger" v1** (deep indigo `#1C2B4A` + aged-paper `#F7F3EC` + stamped-rust `#B8532F` + sage `#8A9A5B`, with a literal rubber-stamp motif and slab-serif/grotesque pairing) — rejected as too literal ("brown ledger aesthetic" as costume, not system); the stamp motif was decorative rather than information-bearing, and the palette sat too close to existing heritage-fintech visual territory.
- **"Switchboard"** (near-black forest `#14231F` + bone `#E8E4DA` + acid-lime `#D6FF3F` accent, node/connection visual language built around the human-handover mechanic) — considered strong for selling the technical handover differentiator specifically, but not selected; noted here in case a more "premium/technical" direction is wanted for an enterprise/VIP-tier variant later.
- **"Signal"** (ink navy `#0F1E2E` + warm white + coral-orange `#E8734A` + steel blue, editorial serif + humanist sans, reimagined read-receipt motif for automation confidence) — closest to a "safe SaaS default," explicitly not chosen because it was the least distinctive of the three original directions.

The final "Duplicate Copy" v2 direction kept the ledger/carbon-copy soul but sharpened it: fewer colors, one accent instead of multiple status colors, dropped literal paper texture for a flat screen-clean cream, and made every signature element (serial numbers, the gray audit-distinction, the single margin rule) do real informational work rather than decorate.

---

## 8. Visualization Prompt (for Lovable / mockup tools)

The following is the exact prompt already used to generate a first-pass render — reuse verbatim for consistency if re-rendering or extending to new screens:

```
Design a SaaS landing page + dashboard for "Flought," a WhatsApp automation
platform for Indian small businesses (clinics, retail shops, construction
dealers). The visual concept is "Duplicate Copy" — inspired by the carbon-copy
bill books used by Indian shopkeepers, where writing on the top sheet produces
a faint duplicate underneath. This isn't decorative nostalgia — it mirrors what
the product does: every WhatsApp conversation is the "original" the customer
sees, and the compliance/audit log is the "duplicate" the business keeps.

COLOR PALETTE (use exactly these, no substitutions):
- Background: #F5F0E6 (bill-paper cream, flat, no texture/grain overlay)
- Primary text/ink: #1A1F3C (carbon-ink indigo, near-black)
- Single accent (status/action only, never decorative): #C1440E (rubber-stamp red)
- Secondary/muted (audit-trail, duplicate-copy UI only): #8B8378 (carbon-smudge gray)

TYPOGRAPHY:
- Display/record face: a typewriter-influenced slab serif — use ONLY for things
  that represent a written record: invoice-style conversation IDs, timestamps,
  serial numbers. Do not use it for general headings.
- Body/UI face: a clean grotesque sans-serif for everything else (nav, buttons,
  paragraph text, general dashboard UI)

LANDING PAGE HERO:
Split layout. Left: a real-looking WhatsApp conversation thread that resolves
live — customer asks a question, a stamp-style "AUTO-RESOLVED" mark stamps down
in #C1440E as the bot answers instantly. Right: plain, confident headline copy
(no stock illustration, no 3D shapes, no gradient blobs). A thin vertical rule
in #C1440E runs down the left margin of the page, echoing the red margin line
on real ledger paper — used once, not repeated as a decorative pattern.

DASHBOARD — CONVERSATION LIST VIEW:
Render conversations as ledger line-items/rows, NOT rounded chat-bubble cards.
Each row gets:
- A serial number styled in the typewriter slab face (e.g. "No. 00482"),
  left-aligned, like an invoice number
- Customer name/phone in the grotesque sans
- A stamp-style status badge in #C1440E only ("RESOLVED" / "HANDOVER" /
  "PENDING") — no other status colors, no green/yellow indicators
- A muted #8B8378 secondary line showing the compliance/audit snippet
  (what the system logged), visually distinct from the primary message
  (what the customer saw) — this gray is reserved ONLY for this duplicate-
  record purpose, not used as generic muted text elsewhere

RESTRAINT RULES:
- No rounded pill buttons or soft drop shadows — flat, ledger-flat surfaces
- No gradients anywhere
- The red accent appears only on stamps, the one margin rule, and primary CTAs
  — never as a background fill or decorative block
- No texture/paper-grain filters — keep the cream flat and screen-clean
- Mobile view: stack the hero split vertically, keep the margin rule on the
  conversation thread only, not the whole page

Overall mood: a working shopkeeper's ledger book digitized — trustworthy,
unmistakably rooted in Indian small-business visual culture, not corporate-SaaS
generic, not kitschy/costumed.
```

---

## 9. Open Item

This direction is **finalized but not yet visually test-rendered** — the next step per the original decision is to actually run the prompt in §8 through Lovable and react to the concrete render before treating this as fully locked. If the render reveals the concept doesn't hold up on-screen, update this document first, then the build.

---

## 10. Traceability

This document governs the visual layer of `flought-TRD.md`'s frontend build (§8, Lovable sequencing). Any new screen or component added to the dashboard should be checked against §4 and §5 here before styling — the test is always "does this color/element encode something real about the product," not "does this look nice."
