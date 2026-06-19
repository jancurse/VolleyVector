---
name: commit
description: Stage and commit changes cleanly: choose what belongs in the commit, then write a concise, proportional message. Use when committing changes or writing a commit message.
---

# Commit

Make one clean commit: decide what belongs in it, then write a message no larger than the change.

## Choosing what to commit

- **Scope**: by default, commit all changes, staged and unstaged. Narrow to a subset only when the user asks, and stop to ask when the intended scope is unclear.
- **Context**: gather only the context you are missing. If you just made the changes, read nothing; if a plan with implementation notes covers them, work from that; otherwise read the diff.

## Writing the message

Write the smallest message that explains the change: a one-line fix gets a one-line message, and a large feature earns a short paragraph.

- **Subject**: one imperative line saying what the change does ("Add X", "Fix Y", not "Fixed Y"). Keep it under ~70 characters, and name the change rather than every part of it.
- **Body**: add one when the diff and subject do not make the change clear on their own. Explain what the change does where that is not obvious, and why where the reason matters. Skip it when the subject and diff already tell the whole story.
- **Bullets**: use them when the change has several independent parts; a single sentence when it is one thing.
- **Say each thing once**: do not repeat the subject in the body.
- **Cut**: filler openers, restated file lists, and process narration such as how you found the bug or what you tried.
