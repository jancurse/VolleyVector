# AGENTS.md

This file provides guidance to LLM agents when working with code in this repository.

## Repository Overview

VolleyCoach is a single-page web app for building, browsing, sharing, and animating volleyball tactics and drills. It is currently a React 19 + TypeScript + Vite project.

See @plans/project_overview.md for the scope, stack, architecture, and build plan. Read it before non-trivial work, and honour the architectural decisions it records rather than relitigating them.

## Writing Code

- Always read the style guide before writing code: @docs/style_guide.md
- We use Prettier, ESLint, and the TypeScript compiler with a 120-character line length. Do not break lines manually. Run Prettier instead. Settings live in @package.json (Prettier), @eslint.config.js (ESLint), and @tsconfig.json (TypeScript).
- **Markdown: never hard-wrap a sentence to satisfy a character count.** A single sentence stays on one line and soft-wraps in the editor. You may break lines at sentence boundaries (or other clause/logical boundaries) for clarity — one sentence per line is fine — but do not split a sentence across lines just to hit a width limit. The 120-character limit is a code rule and does not apply to Markdown prose.
- Code should be concise and readable:
    - Use comments very sparingly. Only write comments to explain a complicated block of code or an unusual line. Do not restate every single line.
    - Do not create more variables than needed. Use inline expressions rather than creating a variable for a one-time use (unless very complicated).
    - Do not rename variables if you modify them unless the old one is still needed.

## Running Code

All commands run from the project root. See @docs/development.md for the full list.

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks and builds for production
- `npm run format`, `npm run lint`, and `npm run typecheck` format, lint, and type-check `src`/`tests`
- `npm run test` runs the test suite

Use the diagnostics skill after code changes to ensure formatting, linting, and type checking all pass. Use the react-testing skill when writing or modifying tests. Do not disable warnings (`// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, etc.) without user permission.

## Problem Solving

- Follow instructions exactly as stated. Do not make assumptions.
- Make minimal changes required to complete your task. Do not make any changes beyond the instructions.
- Analyse the specific situation before giving advice. Do not give generic answers or troubleshooting steps.
- **Stay on track**: answer the question that was asked. Do not jump to implementing or summarising instead. If you lose track of the task, say so and ask rather than flailing.
- **Never silently substitute**: if you cannot complete a specific instruction (a file is missing, a tool fails), stop and say so. Do not quietly do something different and present it as the original request.
- **Flag reversals explicitly**: when you change your mind about a recommendation, say so plainly and explain why, rather than sliding into a new direction as if it were a continuation.
- If you cannot find a perfect solution meeting all requirements, clearly state this. Do not present an alternative as the solution. Make clear where it falls short.
- If you are unsure what to do or have low confidence in your solution, ask for clarification instead of proposing a poor solution.
- Report results factually without positive spin. If errors or issues remain unresolved, state them clearly.

## Package Management

- Use `npm`. Install with `npm install <package>` (runtime) or `npm install -D <package>` (dev tooling).
- Commit `package-lock.json`. CI runs `npm ci` against it.
