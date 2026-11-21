# 004 · Drafts in the tracker

Branch: `004-app-integration` · Status: planned

## Goal

Let the tracker work from a draft: a list of contacts that each have a time and still need describing.
A draft comes from the recorder's own marks or from a model, and the recorder completes it the same way in both cases.

[Task 003](003-rally-touches.md) showed that Gemini's touch list is worth correcting and not worth trusting. This task builds the place where it is corrected, then tests how a coach can get a draft without us paying for it.

## Scope

### The draft layer in the set format

- `AppData` stays at version 2 and gains one optional `draft` field. A set file without it loads as before.
- The draft holds rallies (start, end, serving side) and contacts (time, and optionally side and skill). It is not part of `events`.
- Nothing outside the tracker reads the draft. Rallies, the score and every stats page are still derived from `events` alone.
- The draft is kept in the set's working copy only, never in its saved stats.
- `meta` gains which half of the court is ours and how the video is turned. A model needs both, and the set files do not hold them today.

### Marks become saved draft contacts

- Tab already marks a contact during play, and Enter steps through the marks to describe them. The marks live in the tracker's memory and are lost on reload.
- Marks are saved in the draft, so a recorder can mark a whole rally or a whole set first and describe it later.
- The review pass can be gone through more than once. A contact can be left undescribed and picked up again.
- A draft contact that carries a skill opens the entry panel with that skill pre-filled, as a predicted skill is today.
- Deleting a draft contact takes one key. A model's draft has about one false contact in four.

### Opponent touches

A set recording detailed stats also records two of the opponent's touches. A set without detailed stats records none, as today.

- **Their serve.** It has a time and nothing to describe. A rally they serve starts there, and a rally we never touch needs no manual point: they serve next after an ace, and we serve next after their error.
- **Their first contact after a ball of ours**, a dig or a block. A dig gets its grade (0-1 or 2-3). A block gets tool, in play, or kill. Both are chosen by hand.
- Each choice is stored once, as the result of our serve or attack, where the stats pages read it today. Their touch holds only its time and skill.
- Their sets and attacks are not recorded. An untouched kill of theirs stays a manual point.
- A detailed set recorded before this task has no opponent touches and stays valid.

### Loading a draft

- A model's draft loads only into a set recording detailed stats. Saved marks work in every set.
- From the model's touches of their side, loading keeps their serves and their first contact after each ball of ours, and drops the rest.
- A small draft format of its own, which a model can write: rallies and contacts with times, and no ids, players or meta.
- Its parser is strict on structure and lenient on content, like the bundle parser: it drops what it cannot read and says so.
- Only a team's coaches and admins load a draft, as only they record a set.
- A draft loads into a set by pasting or picking a file. It replaces the set's model-made contacts and keeps the recorder's own marks.
- A draft contact within 1.5 s of a recorded touch counts as done, so a draft can be loaded into a set that is partly recorded.
- One control shifts every draft time by a constant, for a draft made from another cut of the video.
- The rallies give the tracker a jump to the next serve.

### Three ways to get a draft

Tested in this order, cheapest first:

1. **Paste.** The app shows the prompt, the coach runs it in the Gemini app on their own plan, and pastes the answer. [Task 005](005-cheaper-gemini.md) tests whether the Gemini app gives a usable draft.
2. **Script.** Task 003's scripts write a draft file from their cached answers. No new calls.
3. **The coach's own key in the browser.** The key stays in `localStorage` and calls go from the browser to Google. Build it only if the YouTube test below passes.

### The YouTube test

The research sent uploaded files. In the app a set is a YouTube link, and we have no storage for video.

- First check for free whether the API takes an unlisted video, and whether it takes offsets on a YouTube link.
- Then run one set through its YouTube link at task 003's setting, and score it against the cached run of the same set from the file.
- A sideways video cannot be turned in the browser. Test once whether telling the model about the turn is enough.

### Out of scope

- A key held on our server, payments, and video storage.
- The player, the result and the zone of a contact.
- Improving the prompt or the model's score.

## Inputs

- [Task 003](003-rally-touches.md): the setting, the prompt, and the cached answers for all 14 clips.
- `src/stats/`: the set format (`types.ts`), the set-file parser (`store.ts`), and the tracker's marks and entry panel (`tracker/`).
- `src/bundle/`: the pattern for a lenient parser with notices.
- [../data.md](../data.md): the clips, and the YouTube videos they were cut from.

## Spending

- The rule in [../CLAUDE.md](../CLAUDE.md) holds: one clip first, at most three, and the cost stated before each paid run.
- Everything but the YouTube test is free. That test is one set, about $0.70, or $2 with the sideways check and one repeat.
- **The soft limit is $3** at list prices. Stop and ask the user before going past it.
- **The hard limit is £7**, the prepaid credit left on 2026-11-21 (£7.13). Do not add credit, and stop and report if a call fails for lack of it.
- Google takes 20% VAT from the credit on top of the list price, so $3 of calls costs about £2.75 of credit.
- Count the tokens of every call and report the total.
- The other rules of task 002 hold: one paid project, no other accounts, never print or commit the key.

## Done when

- A set file from before this task loads and exports unchanged, and a test proves it.
- Marks survive a reload, and a rally can be marked first and described in a second pass.
- A detailed set records their serves and their first contacts, and each fills the result of our touch before it.
- A draft written by task 003's script loads into a set, and the recorder can complete, correct and delete its contacts.
- A pasted draft loads the same way as a draft file.
- Results says whether a YouTube link scores like the uploaded file, and whether unlisted videos work.
- Results says whether the in-browser key route was built, and why or why not.
- The user guide and `docs/architecture.md` describe the draft.

## Results

The session fills this in at the end: what was built, what worked, what didn't, and follow-ups.
Add anything that matters beyond this task to ../log.md.
