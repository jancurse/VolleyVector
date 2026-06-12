# Bundle Rotation Support

## Implementation Agent Instructions

- **Role**: TypeScript/React engineer who knows the VolleyCoach bundle format and rotation model.
- **Task**: Carry rotations through the bundle format so export, import, and replace are lossless, and bring the board-creator skill and docs in lockstep.
- **Quality bar**:
    - Read @CLAUDE.md and the style guide, and follow them to the letter.
    - Make minimal changes to implement the feature.
    - Write clean, easy-to-maintain code.
    - Every documentation and skill edit must match the brevity and tone of the surrounding text: extend existing tables, bullets, and examples rather than adding new sections or paragraphs.
- **Required reading**:
    - @CLAUDE.md
    - @docs/style_guide.md
    - @src/bundle/types.ts, @src/bundle/serialize.ts, @src/bundle/parse.ts
    - @src/boards/types.ts (`StepRotation`, `RotationSlot`), @src/boards/rotation.ts
    - @src/bundle/ReplaceBoardDialog.tsx
    - @.claude/skills/board-creator/ (SKILL.md, format.md, court.md, examples/, scripts/validate.mjs)
- **Fill Implementation Notes (MANDATORY)**: Before declaring done, fill `## Implementation Notes` in the plan file per its section description. No "done" claim is valid until the section is present.
- **Surface follow-ups (MANDATORY)**: Items in `## Follow-ups` are future projects, not part of this task — do not implement them. If you uncover unplanned work that belongs in its own future project, add it there (one feature per top-level bullet, its tasks as sub-bullets). Before declaring done, re-read `## Follow-ups` and restate every item verbatim in your final message, each as `- [ ] <item>`, so the user can review what you deferred. If the section is `_None._`, write `Follow-ups: none.`

## Plan

### Goals

- A board's per-step `rotation` and board-level `rotationStrict` survive export → import and export → replace.
- The skill can author rotations and its documentation matches the format exactly.
- `docs/architecture.md` correctly describes what the bundle carries.

### Format change

- Add optional `rotation` to `BundleStep` and optional `rotationStrict` to `BundleBoard` in `src/bundle/types.ts`. The rotation carries the model's `StepRotation` shape verbatim (custom-assignment slot keys are strings in JSON), the same way annotations travel as their stored shape.
- Bump `FORMAT_VERSION` to 2. Version-1 bundles already parse via the existing older-version notice; the new fields are optional, so no extra normalization is needed.
- `serialize.ts` emits both fields (rotation only when set, matching how annotations are emitted).
- `parse.ts` validates them with the existing strict-structure / lenient-content split:
    - `rotationStrict` must be a boolean when present (error otherwise, like `autoArrows`).
    - An unusable `rotation` is dropped with a notice, like an invalid annotation. A custom assignment keeps only entries with a valid slot (1–6) and a known marker id, noticing what it drops. An incomplete custom assignment and a preset on a non-5-1 roster are valid model states (rotation is simply inactive) and import as-is.

### Replace from JSON

- The bundle is the whole content: `rotationStrict` takes the bundle's value, absent meaning false, exactly as on import. Per-step rotations follow the steps the bundle carries. No special casing in `ReplaceBoardDialog` — losslessness comes from serialize always emitting the fields, and from the skill carrying them forward when iterating.

### Skill

- `scripts/validate.mjs`: bump its `FORMAT_VERSION`, validate the new fields to the same rules as `parse.ts` (errors for malformed structure, warnings for content the app drops or ignores).
- `format.md`: add `rotation` to one step of the JSON example and `rotationStrict` to its board, extend the optional-with-defaults line, and add one Rules bullet giving both shapes and that an unusable rotation is dropped with a notice. About five lines in total.
- `court.md`: add an "Official spot" column with the `OFFICIAL_SPOTS` coordinates to the existing Rotation zones table. No new section.
- `SKILL.md`: one bullet under Model invariants: set a preset rotation when the content is rotation-specific (requires a 5-1 roster), prefer preset over custom, and keep rotation fields you did not change when folding a pasted bundle back into a draft.
- `examples/serve-receive.json`: give its boards their preset rotations, so the example shows the field and the lockstep test exercises it.

### Docs

- `docs/architecture.md`: in "The bundle format", correct the claim that bundles carry everything but server-owned fields, now that rotations are carried; keep it to the existing sentence's length.

### Testing

Add or update unit tests to cover the changed behavior — no more than the changes require. Use the `react-testing` skill for frontend tests.

- Round-trip: a board with a preset rotation, a custom rotation, and `rotationStrict` survives serialize → parse.
- Parse leniency: malformed `rotation` dropped with a notice; malformed `rotationStrict` is an error; a version-1 bundle imports with the older-format notice.
- Replace: rotation state behaves per the agreed rule.
- The existing example-bundles test keeps the skill examples and the real parser in lockstep.

### Acceptance Criteria

- All tests pass.
- All diagnostics pass (use the `diagnostics` skill to check).
- Exporting and re-importing a board with rotations reproduces them exactly.
- Replace from JSON no longer wipes rotation state when given a full export of the same board.
- `format.md`, `validate.mjs`, and `src/bundle/types.ts` agree on format version 2.

## Follow-ups

_None._

## Implementation Notes

### What changed

- `src/bundle/types.ts`: `FORMAT_VERSION` is now 2. `BundleStep` gains optional `rotation` (the model's `StepRotation` verbatim) and `BundleBoard` gains optional `rotationStrict`.
- `src/bundle/serialize.ts` emits `rotation` only when a step has one and `rotationStrict` always, matching how annotations and `autoArrows` travel.
- `src/bundle/parse.ts`:
    - A non-boolean `rotationStrict` is a structural error, like `autoArrows`. On import it defaults to false.
    - A new `parseRotation` helper validates each step's rotation. An unusable one (not an object, unknown kind, preset slot outside 1–6, custom without an assignment map) is dropped with a notice. A custom assignment keeps only entries with a valid slot and a known marker id, noticing how many it dropped. Incomplete custom assignments and presets on a non-5-1 roster import as-is, since both are valid inactive model states.
    - `parseBoardEntry` now also receives the `notices` array, since rotation leniency happens there (it needs the marker ids) rather than in `materialize`.
- `ReplaceBoardDialog` needed no change: the replacement spreads the parsed bundle board, so `rotationStrict` and per-step rotations now come from the bundle.
- Skill lockstep: `validate.mjs` is at version 2 and warns on rotations the app would drop; `format.md` documents both fields (example plus one Rules bullet); `court.md` adds the Official spot column from `OFFICIAL_SPOTS`; `SKILL.md` adds the preset-rotation invariant; both example bundles are version 2 and `serve-receive.json` carries preset rotation 1 on every step.
- `docs/architecture.md`: the bundle-format sentence now says bundles carry boards in full, rotations included.

### Tests

- `tests/bundle/serialize.test.ts`: a round-trip test covering a preset rotation, a custom rotation, and `rotationStrict: true`.
- `tests/bundle/parse.test.ts`: the fixture is version 2, the newer-version case uses 3, the older-version case uses 1, plus a rejects case for a non-boolean `rotationStrict` and a leniency test for dropped rotations, pruned custom entries, and the false default.
- `tests/App.test.tsx`: the two Copy JSON tests and the import fixture asserted `formatVersion: 1` literally; they now use the exported `FORMAT_VERSION`.

### Critical Issues

None. All 454 tests, the production build, and all diagnostics pass.
