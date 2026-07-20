---
name: Changelog Generator
description: Triggered when the user says "document this change", "documentation", or similar phrases. Automates the generation of a changelog based on actual git state.
---
# Changelog Generator Skill

When triggered, you must perform the following steps to document the session changes:

1. **Check Actual State**:
   - Run `git status` to see what files have been modified.
   - Run `git diff` (and `git diff --staged` if necessary) to review the exact code changes.
   - Do NOT rely purely on your memory of the conversation; ground your documentation in the actual git diff.

2. **Generate Changelog**:
   - Refer to the **CHANGELOG GENERATION RULE** in the workspace's `AGENTS.md` for the exact format requirements.
   - Separate multiple unrelated changes into distinct entries using `---`.
   - Do not mark unverified claims as confirmed (mark as "assumed, not tested").

3. **Save Output**:
   - Write the output to a markdown file in the `docs/changelog/` directory.
   - The file must be named `YYYY-MM-DD_<slug>.md`.
