## CHANGELOG GENERATION RULE

When asked to document changes made in a session, you MUST strictly adhere to the following workflow and format:

1. **Check Actual State First**: Do not rely on memory. Run `git status` and `git diff` (or `git diff --staged`) to see every file actually touched.
2. **Output Location**: Write the output to `docs/changelog/YYYY-MM-DD_<slug>.md` (create the folder if missing).
3. **Multiple Changes**: If the session covered multiple unrelated changes, write a SEPARATE entry (separated by `---`) for each.
4. **Accuracy**: Do not state anything as confirmed unless you actually verified it in the session; mark unverified claims as "assumed, not tested."
5. **Format**: Use EXACTLY the structure below. Do not skip a section — write "N/A" if genuinely not applicable.

---
## <Short title of the change>

**Date:** <today>
**Project:** <repo/project name>
**Branch:** <branch>  |  **Commit:** <short hash, or "uncommitted">
**Type:** Bug fix | Feature | Refactor | Config | Breaking change

### Issue
- Symptom: <exact error message / observed behavior — verbatim if there was one>
- Root cause: <the actual mechanism, traced to the specific function/line. If not fully confirmed, say "suspected cause" — do not state it as fact>
- How the root cause was confirmed: <logs read, reproduction steps, debugger output — or "not independently confirmed">

### Fix
- What changed, in plain language
- Why this approach — and what alternative(s) were considered and rejected
- Assumptions made

### Files Changed
Every file touched, no exceptions:
- `path/to/file` — Added / Modified / Deleted — one-line summary
- For the core logic change(s), include a short before → after diff snippet (not the whole file)

### Verification
- Exact steps taken to confirm the fix works (commands run, inputs/outputs, manual test steps)
- If tests were written or modified in this SAME session as the fix: state that explicitly, and flag that they were not independently verified against a second method (same author, same blind spots)
- What was NOT tested / known gaps

### Revert Instructions
- If committed: `git revert <hash>` — or exact `git checkout <hash> -- <files>` for a partial revert
- If not committed: exact manual steps — which file, which lines, restore to what
- Non-code side effects to undo manually (env vars, DB migration, third-party dashboard config, cache, webhook config, etc.) — write "none" if genuinely none

### Blast Radius
- What else depends on this code / could break as a side effect
- External services or config touched (env vars, API keys, DB schema, webhooks)

### Follow-up / Known Debt
- TODOs introduced by this fix
- Anything deferred or deliberately left unhandled
---
