---
name: code-review-custom
description: Review changed code for correctness, reuse, quality, and efficiency, then report findings
---

# Code Review Skill

Review code for correctness, cleanliness, and codebase fit. The user will specify what to review: a commit, staged changes, a branch diff, specific files, or existing code.

## Process

1. **Gather the code**: obtain the changes or files to review based on user context.
2. **Read surrounding code**: read the full files and related modules. Do not review the diff in isolation.
3. **Find potential issues**: evaluate every item in the checklist below. Collect candidate findings, but do not categorize or write them up yet. Only raise actual issues, and do not pad.
4. **Investigate each finding with subagents**: spawn one Agent tool call per candidate finding, in parallel, in a single message. Each subagent reads the relevant code, traces concrete scenarios, and returns confirmed (with evidence and severity: ISSUE/SUGGESTION/NOTE) or dismissed (with reasoning). You do not evaluate candidates in your own reasoning. That is the subagent's job.
5. **Run the diagnostics skill**: check diagnostics using the diagnostics skill on all changed files. You must use the skill, not raw tool calls.
6. **Report**: present only confirmed findings using the format below.

## Checklist

- **Style & conventions**: complies with the style guide (@docs/style_guide.md) and AGENTS.md rules.
- **Cleanliness**: no dead code, unused imports, debugging artifacts, unnecessary variables, or speculative abstractions.
- **Simplification**: can any logic be simplified, with fewer branches, less indirection, or consolidated repetition?
- **Codebase fit**: no duplication of existing functionality. Search for similar patterns before approving new ones. Consistent naming and patterns with surrounding code.
- **Correctness**: the logic does what it's meant to, handling the expected inputs and the edge cases without bugs.
- **Security**: changes preserve confidentiality, integrity, and availability. Secrets stay out of client code, untrusted input is handled safely, and access is enforced server-side rather than trusted to the client.
- **Testing**: sufficient tests for new/changed behaviour, following the react-testing skill rules. If tests are missing or inadequate, specify what should be tested.
- **Documentation**: behaviour, data-model, or module-structure changes are reflected in the docs (README.md, AGENTS.md, docs/architecture.md). New documentation is proportional to the change, never over-explaining a small feature to the point of drowning surrounding content.
- **Diagnostics**: all changed files pass formatting, linting, and type checking.

## Rigor

- **Read the full diff and review all changes thoroughly.** Do not skim.
- **Do not pad the report.** Fewer well-founded findings are better than many speculative ones. An empty SUGGESTIONS section is perfectly fine.
- **The verdict must be consistent with the findings.** Do not list findings then contradict them.
- **Every finding in the final report must have been verified by a subagent**, including ones you notice while writing the report or running diagnostics. If a finding was not verified by a subagent, either dispatch one for it now or drop it.

## Report Format

Report every subagent-confirmed finding, grouped by the severity the subagent assigned. Omit empty categories. Do not drop, downgrade, or upgrade a subagent-confirmed finding based on your own judgment.

- **ISSUES** (must fix): bugs, style violations, missing tests, duplicated functionality, security concerns.
- **SUGGESTIONS** (should consider): simplification, naming, structural improvements.
- **NOTES** (informational): observations, questions for the author.

End with a one-line verdict, determined mechanically by the report contents:

- **CHANGES REQUIRED**: one or more ISSUES.
- **CHANGES SUGGESTED**: zero ISSUES but one or more SUGGESTIONS. NOTES alone do not trigger this.
- **APPROVE**: zero ISSUES and zero SUGGESTIONS. NOTES are allowed.

Do not soften the verdict. If the report contains a SUGGESTION, the verdict is CHANGES SUGGESTED, never APPROVE with "minor polish" or similar hedging.
