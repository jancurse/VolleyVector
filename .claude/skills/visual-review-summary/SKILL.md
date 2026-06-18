---
name: visual-review-summary
description: Summarise a branch's changes as a concise inspection list for the user to review visually and functionally. Use when the user asks what changed so they can review, QA, or eyeball the work.
---

# Visual review summary

Produce a summary that tells the user **what to inspect** so they can review the change visually and functionally. The user already knows how to review. Give them the list of what changed and where, never how to check it.

## Scope

Use the range the user gives. Otherwise default to the full change on the current branch since it diverged from its base: for a worktree, the feature branch it branched from; otherwise wherever it branched off. Diff against that branch point and cover committed and uncommitted work together; do not narrow to the latest commit or the uncommitted changes alone. If you are not sure of the range, ask.

## Output

Write one message in this shape, and nothing else:

- **Intro.** One or two plain sentences naming what the change is.
- **List.** Every user-facing item that needs inspecting, one bullet per item, covering both how it looks and what it does. Group related items under a parent bullet with sub-bullets (for example, one bullet for a logo, sub-bullets for each place it appears).

## Rules

- Complete and concise: include every change worth inspecting, and nothing more.
- One bullet per item to check, readable at a glance.
- No padding: no preamble, no restating the request, no closing remarks.
- No code, no file names or paths, no links to code. Describe each change by what the user perceives, not where it lives.
- No review instructions: never explain how to open, run, navigate to, or verify anything.
