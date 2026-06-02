---
name: react-testing
description: Write and run React unit tests using Vitest and React Testing Library
---

# React Testing Skill

Write React unit tests following project conventions using Vitest and React Testing Library.

## Goal

Write unit tests that are easy to read, very short, and mimic how a user interacts with the component.

## Process

1. Write or improve unit tests as instructed by the user. Strictly adhere to the rules below.
2. Check the implementation to make sure you adhere to all rules below.
3. Invoke the diagnostics skill to make sure there are no issues.
4. Run the tests to make sure they all pass. If you have to make changes, repeat from step 1.

**CRITICAL: Repeat steps 1 to 4 until ALL issues are resolved.**

- If ANY diagnostic issues remain after step 3, continue from step 1 to fix them.
- If ANY tests fail after step 4, continue from step 1 to fix them.
- Continue until a full iteration has 0 diagnostic issues (no errors, warnings, or hints) and 0 test failures.

**EXIT CONDITIONS:**

- **SUCCESS**: a full iteration of steps 1 to 4 with no issues and no code changes. Report success.
- **FAILURE**: if you cannot resolve all issues after reasonable attempts, report FAILURE with specific details about what could not be fixed.

## Reporting

When you complete a full iteration of steps 1 to 4 with no code changes needed, report:

**FINAL ITERATION RESULTS:**

- **Step 1 (Code Changes in Last Iteration):** Code changes made: [YES/NO]. If YES, the task is INCOMPLETE. Continue until an iteration requires zero changes.
- **Step 2 (Rules Compliance):** All rules followed: [YES/NO]. If NO, this is FAILURE. Specify which rules were violated.
- **Step 3 (Diagnostics, must ALL be perfect):** Prettier: [PASS/FAIL], ESLint: [X issues], TypeScript: [X errors]. If any issues > 0 or formatting failed, this is FAILURE.
- **Step 4 (Tests):** [X passed, Y failed]. If Y > 0, this is FAILURE.
- **OVERALL VERDICT: [SUCCESS/FAILURE].**

**HONESTY REQUIREMENT:** Report ALL remaining issues, not just what worked. Do not use success indicators or claim "completed"/"success" when any issues remain.

## Rules

### Style

- Follow the TypeScript/React style guide (@docs/style_guide.md).
- Use type annotations for function parameters and return values.
- Actually invoke the diagnostics skill and run all its tools (Prettier, ESLint, TypeScript compiler).
- ALL diagnostic issues must be resolved (errors, warnings, hints) before proceeding. No exceptions.
- Use concise descriptions for test cases.

### Testing

- ALL tests must pass 100% before proceeding. No test failures are acceptable.
- **ONLY MOCK EXTERNAL DEPENDENCIES:**
    - **DO NOT mock our own components/hooks/utilities**: use real instances to test real integration.
    - **OK to mock external dependencies**: Supabase, `fetch`/network calls, browser APIs, external libraries.
- Write as few tests as possible to achieve high coverage by parametrizing with `describe.each` / `test.each`. Do not write multiple tests with near-identical code. Combine and parametrize.
- Test behaviour, not implementation details.
- Query elements by accessibility (role, label, text), not implementation (class names, test IDs).
- Use `@testing-library/user-event` for realistic user interactions.
- Only test user-facing behaviour and public APIs. Do not test internal state or private methods. Let the code flow naturally through all paths via appropriate test parameters.

## Commands

- Run all tests: `npm run test`
- Run with coverage: `npm run test:coverage`
- Run in watch mode: `npm run test:watch`
- Run with UI: `npm run test:ui`
- Run a specific test: `npm run test -- <test-file-path>`

## Organization

- Mirror the `src/` folder and module structure exactly under `tests/`.
- Test files use the `.test.ts` or `.test.tsx` extension.
- Place global test setup and shared mocks in `tests/setup.ts`.
