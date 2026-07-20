---
## Contact Upsert Restoration (C-1)

**Date:** 2026-07-20
**Project:** Watsapp-Saas
**Branch:** main  |  **Commit:** uncommitted
**Type:** Bug fix

### Issue
- Symptom: New incoming WhatsApp messages were not auto-creating or updating contact records.
- Root cause: The `is_new_session` migration (20260716000007) overwrote `process_inbound_message` and silently dropped the `INSERT INTO contacts` block. Confirmed by reading the SQL migration and observing the missing code.
- How the root cause was confirmed: External audit report and manual inspection of the current SQL function definition.

### Fix
- Re-added the `INSERT INTO contacts ... ON CONFLICT ... DO UPDATE` block into the `process_inbound_message` RPC before the conversation lookup.
- Why this approach: It restores the exact logic that was lost in the previous migration, ensuring data integrity without changing the function signature.
- Assumptions made: Assumed the previous `INSERT` block logic was fully correct before it was accidentally dropped.

### Files Changed
- `supabase/migrations/20260716000020_audit_fixes.sql` — Added — New migration containing the corrected `process_inbound_message` RPC.

### Verification
- Exact steps taken: Ran `npm run build` to ensure the project compiles. The SQL migration was verified for syntactic correctness but has *not yet been applied/tested against a live Postgres database* in this session (assumed, not tested).
- What was NOT tested / known gaps: Live insertion of a new contact via the webhook.

### Revert Instructions
- If not committed: manual steps — remove the `process_inbound_message` recreation block from `supabase/migrations/20260716000020_audit_fixes.sql`.

### Blast Radius
- The webhook processing pipeline depends on this RPC. A syntax error here would break all inbound messages.

### Follow-up / Known Debt
- Need to actually apply the migration using Supabase CLI and test with a live webhook.

---
## Cryptographic Key Derivation Fix (C-6)

**Date:** 2026-07-20
**Project:** Watsapp-Saas
**Branch:** main  |  **Commit:** uncommitted
**Type:** Security fix

### Issue
- Symptom: Custom zero-padding of the encryption key in `crypto.ts` was insecure and could result in key collisions or weak AES-256-CBC encryption.
- Root cause: The `padKey` function manually padded the key to 32 bytes using `.padEnd(32, '0')`, which is highly non-standard and degrades entropy.
- How the root cause was confirmed: Source code inspection of `backend/src/bsp/crypto.ts`.

### Fix
- Replaced the custom padding logic with `crypto.scryptSync(secret, 'static_salt', 32)` to securely derive a 32-byte key.
- Why this approach: `scryptSync` is a standard, cryptographically secure key derivation function (KDF) that properly hashes the input regardless of length.
- Assumptions made: Assumed that invalidating previously encrypted tokens in the database is acceptable, or that the tokens haven't been widely provisioned yet.

### Files Changed
- `backend/src/bsp/crypto.ts` — Modified — Replaced `padKey` with `scryptSync`.

### Verification
- Exact steps taken: Ran `npm run build` to verify type safety and compilation. (assumed, not tested at runtime).
- What was NOT tested / known gaps: Did not test decrypting existing tokens. Existing encrypted tokens in the database *will* fail to decrypt because the key derivation has changed.

### Revert Instructions
- If not committed: `git checkout -- backend/src/bsp/crypto.ts` to restore the manual padding.

### Blast Radius
- All encrypted provider configs (e.g., Meta access tokens) rely on this.
- External services: Existing database tokens will become unreadable.

### Follow-up / Known Debt
- Any existing `tenant_bsp_config` rows with encrypted tokens must be re-encrypted or re-authenticated by users, as the old key is now incompatible.

---
## SSRF Blocklist Hardening (H-2)

**Date:** 2026-07-20
**Project:** Watsapp-Saas
**Branch:** main  |  **Commit:** uncommitted
**Type:** Security fix

### Issue
- Symptom: The outbound webhook dispatcher only blocked `localhost` and `127.0.0.1`, leaving the system vulnerable to SSRF via private IP ranges or IPv6 loopbacks.
- Root cause: The `blockedHostnames` array in `webhookService.ts` was incomplete and did not cover RFC 1918 private networks or IPv6.
- How the root cause was confirmed: Manual code inspection of `fireOutboundWebhook`.

### Fix
- Implemented regex and string checks for internal IPs (`10.*`, `192.168.*`, `172.16-31.*`, Carrier-grade NAT) and IPv6 loopbacks/private ranges.
- Why this approach: Hardcoding exact string matches for all private IPs is impossible; regex ensures blanket coverage of standard internal CIDR blocks.
- Assumptions made: The application will never legitimately need to fire a webhook to an internal IP in production.

### Files Changed
- `backend/src/services/webhookService.ts` — Modified — Added regex checks for `isInternalIp` and `isIPv6Private`.

```diff
-      if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
+      const isInternalIp = /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(hostname);
+      const isIPv6Private = hostname.startsWith('[fd') || hostname.startsWith('[fc') || hostname === '[::1]' || hostname === '[::]';
+      
+      if (blockedHostnames.includes(hostname) || hostname.endsWith('.local') || isInternalIp || isIPv6Private) {
```

### Verification
- Exact steps taken: `npm run build` confirmed compilation. (assumed, not tested via live request).
- What was NOT tested / known gaps: Did not spin up a local server to test the regex against edge cases.

### Revert Instructions
- If not committed: `git checkout -- backend/src/services/webhookService.ts`

### Blast Radius
- Any legitimate webhook to a local IP (e.g. during local dev testing without Ngrok) will be blocked.

### Follow-up / Known Debt
- Local development might require a bypass flag if developers test webhooks against local servers.

---
