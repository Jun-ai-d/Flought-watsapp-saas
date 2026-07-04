# Flought — BSP Migration Runbook

**Version:** 1.0
**Companion to:** bsp-abstraction-layer.md, flought-TRD.md
**Purpose:** Operational checklist for migrating a tenant's WhatsApp number between BSPs (e.g., Gupshup → Twilio when a tenant crosses into VIP tier, or onboarding a tenant's existing number onto Flought for the first time). This is a step-by-step runbook, not a policy document — follow it verbatim per migration.

---

## 1. When This Runbook Applies

- A tenant's existing number (already on WhatsApp, personal or another BSP) is being onboarded onto Flought's BSP.
- An existing Flought tenant is being moved from one BSP to another (e.g., Gupshup → Twilio for a newly-VIP client), per the routing rules in `bsp-abstraction-layer.md`.

**Does not apply** to brand-new dedicated numbers with no prior WhatsApp registration — those go through standard Embedded Signup with no migration steps needed.

---

## 2. Pre-Migration Checklist (run every single time, no exceptions)

Run all six checks before starting the migration. Meta's migration API rejects the request the moment any one condition is unmet, and the error messages are notoriously unhelpful — most failed migrations trace back to skipping one of these.

| # | Check | How to verify |
|---|---|---|
| 1 | **2FA is disabled** on the source WABA/phone number | Confirm directly with the source BSP or in Meta Business Manager. This is the single most common failure point — even if the source BSP dashboard shows 2FA as off, the underlying `phone_number_id` may still have it set. |
| 2 | **Source WABA is Approved** (not pending, rejected, or restricted) | Facebook Business Manager → Accounts → WhatsApp Accounts |
| 3 | **Access to the phone number** to receive a 6-digit OTP via SMS or voice call during the handshake | Confirm the tenant/client can receive a call/SMS on that number right when migration starts |
| 4 | **Destination WABA is Approved and verified** | Check in the destination BSP's dashboard before initiating |
| 5 | **Destination BSP's Meta app is authorized** on the Business Manager | Business Manager → Settings → Business Integrations → confirm the destination BSP's app is added with WhatsApp Business Account permissions granted — this step is frequently missed since it isn't always surfaced in the destination BSP's own onboarding flow |
| 6 | **Template count under 250** on the source WABA | If over 250 approved templates exist, Meta may drop some silently during migration — audit and prune before starting (see §5) |

**Do not proceed past this checklist with any box unchecked.** Fixing a failed migration attempt costs more time than the five extra minutes this checklist takes.

---

## 3. Migration Sequence

1. Confirm the tenant/client understands the tradeoffs (§6) and has approved proceeding.
2. Destination BSP (whichever Flought is migrating to) creates a new account entry for the business, using their Business Manager ID + phone number.
3. Destination BSP calls Meta's Migrate API to register the number, with 2FA/PIN disabled.
4. Meta validates the source WABA status and sends an approval email to the Business Manager admin — someone with admin access must click the confirmation link promptly, this is a manual human step that can stall the whole migration if the admin doesn't check email.
5. Meta re-associates the phone number with the destination BSP's infrastructure. The phone number gets a new webhook endpoint.
6. High-quality approved templates copy over automatically. Set the new webhook URL in Flought's backend (per `bsp-abstraction-layer.md` — this is a config change to `tenant_bsp_config`, not a code change).
7. Set a new 2FA PIN on the destination BSP once migration completes.
8. Resume sending — verify with a test message before considering the migration done.

**Typical timeline:** 3–15 minutes from step 3 to step 6, once the pre-migration checklist is fully satisfied. **Risk window:** a brief gap (roughly 90 seconds) between the Meta approval email confirmation and re-association where the number may not send/receive — plan any migration during the tenant's lowest-traffic hours, not during business hours.

---

## 4. What Survives Migration vs. What Doesn't

| Preserved | Not preserved |
|---|---|
| Phone number | Chat history |
| Display name | Low-quality, rejected, or pending templates |
| Quality rating | **Template quality rating itself** — Meta duplicates high-quality templates as "fresh" templates on the destination WABA, so they lose their accumulated quality-rating history even though the template content and Approved status carry over |
| Messaging tier/limits | — |
| Official Business Account (green tick) status | — |
| High-quality approved templates (up to 250) | — |

**This nuance matters for tenant communication:** don't tell tenants "your templates keep their quality rating" — that's not accurate. Say "your approved templates stay usable without re-review, but their quality-rating history resets as new templates" — precise, not oversold.

---

## 5. Template Audit (before migrating, if over 250 templates)

- List all templates on the source WABA, sorted by approval status and last-used date.
- Archive/delete unused, low-quality, or long-rejected templates before migration — they won't survive anyway and pruning avoids Meta silently dropping ones you wanted kept, once you're near the 250 cap.
- Document which templates were archived, in case the tenant asks why an old template disappeared.

---

## 6. Client Conversation Script (what to tell the tenant before migrating)

Use this as the actual disclosure conversation, not just internal knowledge:

> "We can migrate your existing WhatsApp number to Flought without changing your number. Here's exactly what will and won't carry over:
> - ✅ Your number, display name, and current quality rating stay the same.
> - ✅ Your approved message templates will keep working without needing re-approval.
> - ❌ Your chat history will not transfer — this is a Meta platform limitation, not something we can change.
> - ❌ If you're currently on the regular WhatsApp app (not another BSP), you'll lose access to any groups, status, and community features tied to that number, since the number becomes API-only.
> - There will be a brief window (under 2 minutes) where the number may be temporarily unable to send/receive — we'll schedule this during your lowest-traffic hours.
>
> Do you want to proceed with migrating your existing number, or would you prefer a fresh dedicated number instead, which avoids all of the above tradeoffs?"

This should be a **required, logged step** in the Client Onboarding SOP (see next document) — not an assumption the client already understands, since the earlier PRD/TRD conversation established that migration is a one-way decision clients often don't fully grasp upfront.

---

## 7. Post-Migration Verification

- [ ] Send a test message from the destination number and confirm delivery
- [ ] Confirm webhook is firing correctly to Flought's backend (check `tenant_bsp_config.webhook_verify_token` is updated)
- [ ] Confirm `tenant_bsp_config.bsp_provider`, `waba_id`, and `phone_number_id` are updated in the database to reflect the new BSP
- [ ] Re-enable 2FA on the destination BSP
- [ ] Verify template list in Flought's dashboard matches what was expected to survive migration
- [ ] Log the migration event in `audit_log` (tenant_id, old BSP, new BSP, timestamp, performed by)
- [ ] Notify the tenant that migration is complete and confirm they're receiving live messages

---

## 8. Common Failure Modes & Fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| "Permission denied" error on migration call | 2FA still active despite dashboard showing disabled | Ask source BSP support to disable via API directly, not dashboard toggle; check for Meta error code 100, subcode 33 specifically |
| "App not authorized" error | Destination BSP's Meta app wasn't granted Business Manager access | Complete step 5 of the pre-migration checklist before retrying |
| Migration approval email never arrives / isn't clicked | Business Manager admin isn't monitoring the right inbox | Confirm the correct admin email before starting; this is a manual dependency, flag it explicitly to whoever owns that inbox |
| Templates missing after migration | Source WABA exceeded 250 templates | Should have been caught in pre-migration audit (§5) — if not, resubmit missing templates fresh |

---

## 9. Traceability

Every migration performed must be logged via `audit_log` (per `flought-database-schema.md` §6) with enough detail to reconstruct what happened if a tenant disputes chat history loss or billing discrepancies around the migration date.
