---
name: writing-style
description: Write and edit clear, plain prose with no AI-sounding padding. The most common case is Markdown (READMEs, architecture, guides, skill files), but the same rules apply to all text the project ships or stores: UI copy and labels, board titles and instructions, code comments, and commit and PR messages. Use whenever you write or revise any prose.
---

# Writing style

Write like a person who knows the subject and respects the reader's time. The single biggest tell of machine-written prose is padding and fragmented punctuation. Cut both.

These rules apply to **all text**, not just Markdown. The prose-quality rules below hold everywhere: documentation, UI copy, button labels, board titles and step instructions, comments, commit messages. The [Markdown-only](#markdown-only) rules at the end apply only when you are writing a `.md` file.

## Match the document you edit

- When updating an existing doc, keep a new entry or section no longer or denser than the ones already there. Do not let an addition dominate.
- Match the surrounding voice and structure.

## Write concisely, with no padding

- Cut any word or sentence that adds length without adding information.
- Say each point once. Do not restate a claim in different words for emphasis.
- Prefer the short word and the short sentence. Drop hedges and intensifiers ("very", "really", "simply", "just", "seamlessly", "powerful").

## Write direct, plainly-structured prose

- Prefer simple subject-verb-object sentences. Do not pile clauses onto one sentence.
- Split a compound thought into separate sentences.
- Write prose in complete sentences, each with a subject and a finite verb. A verbless fragment is fine only for a label or heading, never for a sentence of running prose.
- **Punctuation does a job. Use the mark that does the job you mean.**
    - A colon introduces what follows. A period ends a thought.
    - **Do not reach for an em dash where a colon or a full stop is what you mean.** Heavy use of em dashes, semicolons, and stacked commas is the main tell of fragmented "AI" prose.
    - If a sentence leans on several of these, rewrite it as two or three plain sentences.
    - This holds for the shortest strings too: a button label or a one-line tooltip gets the same plain punctuation, no em dashes.
        - Before: "Set your lineup and the board lays out every rotation — where each player stands, front and back — and it flags an overlap, too."
        - After: "Set your lineup and the board lays out every rotation: where each player stands, front row and back. It flags an overlap if two players cross."
    - Put a short inline example or aside in parentheses, not after a colon. Reserve the colon for introducing a list or a longer clause.
        - Before: "Issues are welcome: bug reports, ideas, and questions."
        - After: "Issues are welcome (bug reports, ideas, questions)."

## Don't oversell

- Keep titles short and factual ("Rotation 1 serve receive", not "Mastering the Art of Rotation 1").
- No hype words. No title-colon-subtitle patterns.

## Markdown-only

These apply when the file is `.md`:

- **Use a real heading hierarchy.** Give a longer document a `#` title, `##` sections, `###` subsections, deeper where the content earns it.
    - Do not leave a flat stack of `##` headings with nothing beneath them. If everything sits at one level, push detail down into subsections.
    - Avoid a pile of one- or two-line sections. A heading must earn its place. If several are tiny, merge them or demote them to bullets under a parent. (An occasional short section is fine.)
    - Match depth to length: a short note needs no nesting, a long one usually wants several levels.
- **Use bullets and sub-bullets heavily** to organise detail inside a section, instead of adding more headings or writing dense paragraphs.
- **Never hard-wrap a sentence to satisfy a character count.** A single sentence stays on one line and soft-wraps in the editor. You may break lines at sentence boundaries (or other clause boundaries) for clarity, one sentence per line is fine, but do not split a sentence across lines to hit a width limit. The 120-character limit is a code rule and does not apply to Markdown prose.
- **Don't run markdownlint by hand.** A hook auto-formats Markdown after you write or edit a `.md` file: it runs `markdownlint-cli2 --fix` and aligns tables.
