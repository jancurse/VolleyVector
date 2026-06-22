---
name: pr-description
description: Write a concise PR description for the current branch. Use when the user asks for a PR description, PR write-up, PR body, or to open a PR.
---

# PR description

Write a concise PR description for the current branch. By default, save it to a local Markdown file and tell the user the path: do not paste the body into chat. Open a PR only when the user asks for one (see [Opening a PR](#opening-a-pr)).

## Scope

The current branch against `main`, unless the user names a different range. Read the commits and the diff for that range (`git log main..HEAD`, `git diff main...HEAD`) and write from what actually changed, not from the conversation.

## Format

The file is the title line, then the body. Nothing wraps the body.

```md
# [title]

[body]
```

- **[title]**: one concise line naming what the PR does.
- **[body]**: a concise description, usually a single block:
    - a 1–2 line summary of the change,
    - a couple of bullets for the notable parts,
    - a closing issue line: `Closes #N`, or `First part of #N` when the branch only starts that issue.
- Derive `#N` from the branch name (`<issue>-<name>`). Drop the line if there is no issue.
- No headings in the body. For a multi-topic PR, lead each topic with a bold label (`**DNS.** …`) as its own bullet or short paragraph, never a `##`/`###` section. A single-topic PR stays one block.

Keep it proportional: a small PR gets a sentence and one bullet, a large one a short paragraph and a handful. Say each thing once, cut process narration, and describe what changed, not how you found or built it.

## Where to write the file

Save one Markdown file, named `pr-<branch>.md`:

- If `$CLAUDE_JOB_DIR` is set, write to `$CLAUDE_JOB_DIR/tmp/`.
- Otherwise write to `./tmp/` in the project root, creating the folder if it is missing.
- Never write into `~/tmp` directly, and never make a dedicated subfolder for the file.

## Opening a PR

Open a PR only when the user asks: either up front ("write the description and open the PR") or after they have reviewed the file and agreed. Write the file first in both cases; the PR is created from it.

The file maps onto GitHub's two fields. Do not paste the whole file, and do not repeat the title:

- **Title field** ← the `#` title line, with the leading `#` stripped.
- **Body field** ← everything below the title line, and nothing else.

So `gh pr create --title "[title]" --body "[body]"`, where `[title]` is the first line without its `#`, and `[body]` is the rest of the file. Never put the `#` title line in the body, and never put the whole file in either field.
