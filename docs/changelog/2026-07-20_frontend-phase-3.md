---
## Frontend Phase 3: CRM & Automation UI

**Date:** 2026-07-20
**Project:** Watsapp-Saas
**Branch:** main  |  **Commit:** uncommitted
**Type:** Feature

### Issue
- Symptom: N/A (Implementing Phase 3 of Frontend Architecture plan).
- Root cause: N/A
- How the root cause was confirmed: N/A

### Fix
- Updated `FlowBuilder.tsx` to include a new `ConditionNode` enabling visual branching logic based on variables like message body or customer tags.
- Replaced the simple checkbox in `FlowBuilder.tsx` with a distinct "Draft / Published" segmented control to clearly indicate if the automated flow is active.
- Updated `Inbox.tsx` conversation list rendering to show a visual SLA breach flag (flashing "SLA BREACH" and red background) when a conversation has been in `handover_pending` status and unreplied to for over 1 hour.
- Added an "Active Flow" badge in `Inbox.tsx` to visually indicate when a conversation is currently being handled by the bot (`status === 'bot'`).

### Files Changed
- `src/pages/FlowBuilder.tsx` — Modified — Added custom React Flow Condition Node and Draft/Published toggle UI.
- `src/pages/Inbox.tsx` — Modified — Added conditional rendering for SLA breaches and Active Flow indicators in the sidebar list.

```diff
+            {conv.status === 'bot' && (
+              <div className="px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 theme-button flex items-center gap-1">
+                <Bot size={10} /> Active Flow
+              </div>
+            )}
```

### Verification
- Code review confirms the SLA formula: `((Date.now() - new Date(conv.last_message_at).getTime()) / (1000 * 60 * 60) > 1)` appropriately flags older conversations.
- Verified that React Flow custom nodes are successfully registered in `nodeTypes`.

### Revert Instructions
- If not committed: `git checkout HEAD -- src/pages/FlowBuilder.tsx src/pages/Inbox.tsx`

### Blast Radius
- The changes strictly isolated to `FlowBuilder.tsx` and `Inbox.tsx` UI rendering logic without modifying underlying Tanstack Query state mutations.

### Follow-up / Known Debt
- SLA breach calculations currently depend on the local user's browser clock rather than a server-verified timestamp, which could skew slightly.
---
