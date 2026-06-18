# Style Guide

## General

- Use comments only to explain non-obvious logic or important decisions. Avoid redundant comments that restate the code.
- Write code which is easy to read instead of adding excessive comments.
- Keep comments up-to-date with code changes.
- Write concise code:
    - Use short but descriptive names.
    - Use as few variables as possible. Do not create a new variable if it is only used once or twice and is easy to reference inline.
    - Do not rename variables if you modify them unless the old one is still needed.

## TypeScript

- Format with Prettier (120 chars/line) and lint with ESLint. Do not break lines manually. Run Prettier.
- TypeScript strict mode is on. Fix type errors at the root cause. Do not paper over them with `any`, `as`, or `@ts-ignore`.
- Prefer `type` aliases for object/union shapes, and reach for `interface` only when declaration merging is needed.
- Use `const` by default, and `let` only when reassignment is required.
- Prefer pure functions and immutable updates. Avoid mutating props, state, or shared objects.
- Model structured data with explicit types and discriminated unions rather than loose objects or magic strings.

## React

- Function components with hooks only. No class components.
- One component per file, named after the component (`CourtMarker.tsx`).
- Keep components small and focused. Lift shared logic into custom hooks (`useDrillPlayback`) or `utils/`.
- Type props with an explicit `type` (no `prop-types`, since TypeScript handles validation).
- Respect the rules of hooks, and keep dependency arrays correct rather than disabling the lint rule.
- Derive state instead of duplicating it. Keep a single source of truth (e.g. marker identity and normalized position) and compute the rest.

## Types

- Annotate function parameters and return values, and all exported/public APIs.
- Use built-in lowercase array/record syntax (`string[]`, `Record<string, number>`).
- Use wide input types (`readonly T[]`, `Iterable<T>`) for arguments and concrete types for return values.

## Testing

- Use Vitest with React Testing Library. See the react-testing skill for the full rules.
- Write the fewest tests that achieve high coverage by parametrizing with `describe.each` / `test.each`.
- Test behaviour, not implementation. Query by accessible role/label/text, not class names or test IDs.
- Use `@testing-library/user-event` for realistic interactions.
- Do not mock our own components, hooks, or utilities. Test real integration, and mock only external dependencies (network calls, Supabase, browser APIs).
- Mirror the `src/` structure under `tests/`, and name files `*.test.ts` / `*.test.tsx`.

## UI Controls

- Every control renders through the `src/ui/` wrappers and the shared class strings in `src/ui/styles.ts`. Never style a control with ad-hoc classes.
- **Reach for a shared wrapper, not bespoke markup.** A recurring UI structure (a table, an overlay, a list row) renders through a shared `src/ui/` component, not markup hand-assembled at each call site. If you repeat a structure that has no wrapper yet, add one in `src/ui/` and route every use through it, rather than copying its markup or classes.
- **No handpicked style values.** Take every dimension, colour, radius, shadow, and type value from the shared sources: the tokens in `src/ui/styles.ts` and the Tailwind `@theme` scale in `src/index.css`. Never inline an arbitrary value (`max-w-[18rem]`) and never hand-pick a one-off off the scale to make a single component fit. Reuse the existing token for that role when one exists; when none does, add a named token to the shared source and use that, so the value is defined once and shared rather than guessed per component.
- Use one `primary` Button per view: the single main action.
- Use `ghost` for secondary actions. Use `text` or an `IconButton` for quiet actions.
- Use `danger` only for destructive actions.
- Use `dashed` only for an add affordance that stands where its result will appear, shaped like that result (e.g. the new-board tile in the card grid). An add affordance inside a list or nav takes the list's own row style, quiet and borderless, never a dashed button.
- A destructive row action is an `IconButton` with an `aria-label`, never a bespoke button with its own class string.
- **Pickers over growing sets.** A control that reveals all its options at once fits a set that's small and bounded by design. When the set grows with the data (accounts, boards), that loads slowly, gives no way to narrow, and can expose more than the user should see. Ways to keep what's loaded bounded:
    - **Scope to a relationship** (your teams, your teammates), where it makes sense — narrows to who's relevant rather than everyone. Sufficient on its own only when the result is bounded to a small number by design (not merely small today); otherwise combine it with one of the below.
    - **Filter an already-loaded scoped set** — when it's dozens to low hundreds and instant typing helps.
    - **Search server-side** (query with a limit, nothing shown until typed) — when the set is large or sensitive and the user can name the target.
    - **A dedicated paginated page** — when the task is browse or manage, not pick-one.
- Size a control to its content, not its container. A select over a short enum is as wide as its longest option; only genuinely long or free-form values (a title, a description) earn full width.
- A list row leads with what identifies the item, not its controls. Render a rarely-changed field as quiet text or a compact control, never a full-width input.
