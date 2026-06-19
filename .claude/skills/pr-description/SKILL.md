---
name: pr-description
description: Write a concise PR description for the current branch as a Markdown temp file. Use when the user asks for a PR description, PR write-up, or PR body.
---

# PR description

Write a concise PR description and save it as a Markdown temp file. Do not paste the body into chat: produce the file and tell the user its path.

## Scope

The current branch against `main`, unless the user names a different range. Read the commits and the diff for that range (`git log main..HEAD`, `git diff main...HEAD`) and write from what actually changed, not from the conversation.

## Where to write it

Save one Markdown file, named `pr-<branch>.md`:

- If `$CLAUDE_JOB_DIR` is set, write to `$CLAUDE_JOB_DIR/tmp/`.
- Otherwise write to `./tmp/` in the project root, creating the folder if it is missing.
- Never write into `~/tmp` directly, and never make a dedicated subfolder for the file.

## Format

```md
# [title]

## Description

[description]
```

- **[title]**: one concise line naming what the PR does.
- **[description]**: a concise body, usually a single block:
    - a 1–2 line summary of the change,
    - a couple of bullets for the notable parts,
    - a closing issue line: `Closes #N`, or `First part of #N` when the branch only starts that issue.
- Derive `#N` from the branch name (`<issue>-<name>`). Drop the line if there is no issue.
- Use `###` subsections **only** when the PR genuinely covers several distinct topics. A single-topic PR stays one block with no subheadings.

## Writing it

Keep it proportional: a small PR gets a sentence and one bullet, a large one a short paragraph and a handful. Say each thing once, cut process narration, and describe what changed, not how you found or built it.
