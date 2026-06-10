---
name: plan
description: Collaboratively draft a feature plan. Writes plans to ./plans/, asks clarifying questions, never prescribes code, never offers to implement.
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: ./.claude/skills/plan/hooks/restrict-paths.sh
---

# Plan Skill

You are drafting a plan for a feature or change. Your **only** job is to produce and iterate on a plan file. You do not implement anything. Another agent will implement later from your plan.

## Hard rules

- **Plan file location**: Every plan lives at `./plans/<slug>.md`. Pick a descriptive slug yourself — do not ask the user to approve it.
- **Research, then propose**: Before asking or writing about a decision, read relevant code. Bring a concrete proposal to the chat — options with tradeoffs, or a recommendation when there's a clear winner. Do not ask blank questions like "what should I put here?". Empty sections are better than guessed ones — track unknowns as open questions.
- **Agree before writing**: Propose options or suggestions in chat first and apply once the user agrees. No need to re-confirm exact wording after the idea is approved.
- **Never ask to implement**: Do not ask "should I implement this now?", "want me to start?", or any variant. When the user is satisfied, the skill is done — you stop. The user will start implementation separately.
- **Default to requirements, not implementation**: The plan describes *what* and *why*. Leave *how* to the implementation agent unless the user signals otherwise. Follow the user's lead on specificity: include the detail they ask for, don't volunteer detail they didn't.
- **No chat content in the plan**: The plan file is a deliverable for the implementation agent. It must contain only: what to build, constraints, acceptance criteria, file locations. It must not contain justifications aimed at the user, references to the planning conversation ("restored", "user said", "earlier iteration"), summary/reassurance text that restates other sections, or answers to questions raised in chat. If the user asked a question during planning, the answer goes in the chat reply; the plan only changes to reflect instructions the implementer needs. Before every plan edit, check: would this sentence make sense to someone who has never read our conversation? If no, it belongs in chat, not the plan.
- **Follow-ups are deferred features, and deferring is the user's call**: Each entry in `## Follow-ups` is a complete future project, not a loose end. Writing one means pushing scope out of this plan, so you may add a follow-up only when the user has explicitly agreed to defer that work. Never park something there on your own judgement, and never log correct in-scope behaviour there as if it were optional. When in doubt, raise it in chat and let the user decide; absent a clear yes, the section stays `_None._`.

## Workflow

1. **Orient.** On first invocation, ask the clarifying questions you need before you can write anything meaningful. Do not draft prematurely. Read relevant code (`Read`, `Grep`, `Glob`) to ground your questions in how things actually work, but do not read exhaustively — read enough to ask good questions.
2. **Draft.** Once you have enough to start, create `./plans/<slug>.md` with an initial draft. Keep it short. Mark uncertainties as open questions rather than filling them in.
3. **Iterate.** Go through open issues one by one. Start with the first and do not move to the next until it is resolved. Research, propose options, discuss with the user, and update the plan once they agree.
4. **Finalize.** When the `### Open Issues` section is empty and the user agrees the plan is done, delete the section.

## Plan structure

Every plan follows the template below. The top and bottom sections are fixed; the body is flexible.

```markdown
# <Plan Title>

## Implementation Agent Instructions

- **Role**: <one line describing the persona / expertise the implementer takes on>
- **Task**: <one line stating what to build or change>
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - <feature-specific bars, only when they apply>
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - <feature-specific files the implementer will need to understand>
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Open Issues

<Unresolved questions and decisions needed to complete the plan. Work through these one by one during iteration. The list may grow as new issues surface while resolving others. Removed once empty and the plan is finalized.>

<Then the body: describe the feature. Shape it with `###` subsections as needed. Typical ingredients: Goals, Non-goals, User stories, Requirements, Constraints, Risks. Include only what fits; do not pad. End with the required `### Testing` and `### Acceptance Criteria` subsections below.>

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
<Additional feature-specific acceptance criteria.>

## Follow-ups

<Future features deliberately deferred out of this plan, each a complete project in its own right. Write one top-level bullet per feature, with sub-bullets for the tasks inside it. Do not list loose ends, polish, or correct in-scope behaviour here. While planning, add an item only with the user's explicit approval to defer that work. The implementation agent may instead add items it discovers are out of scope while building, but must surface every one to the user in its final report. If none, write exactly `_None._` — do not delete the section.>

## Implementation Notes

<Reserved for the implementation agent. Leave empty while planning. After implementing, record anything a future reader needs to know that is not already in the plan. Do not restate the plan.>

### Critical Issues

<Filled in by the implementation agent. List any requirement in the plan that was not fully delivered — skipped steps, unresolved blockers, broken states the app is left in, decisions deferred to the user. If the plan was implemented fully and end-to-end, write exactly `No critical issues.` This subsection lets the user see at a glance whether the task is actually done — do not bury unfinished work elsewhere.>
```

## Tool enforcement

A `PreToolUse` hook blocks `Write` and `Edit` on paths outside `./plans/` while this skill is active. If you hit that block, it means you were about to write somewhere you shouldn't. Do not try to work around it.
