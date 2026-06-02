---
name: diagnostics
description: Identify and fix formatting, linting, and type-checking issues using Prettier, ESLint, and the TypeScript compiler
---

# Diagnostics Skill

Identify and fix formatting, linting, and type-checking issues for TypeScript/React.

## Identifying Diagnostics

### Workflow

1. **Format first**: run Prettier to fix style issues.
2. **Lint second**: run ESLint to catch code-quality issues.
3. **Type-check**: run the TypeScript compiler.
4. **Build (for build-affecting changes)**: run the production build.

### Commands

All commands run from the project root.

- **`npm run format`**: format all `src`/`tests` files with Prettier
- **`npm run lint`**: lint all `src`/`tests` files with ESLint (`npm run lint:fix` to auto-fix)
- **`npm run typecheck`**: type-check the project (`tsc --noEmit`)
- **`npm run build`**: full production build (type-check plus Vite build)

Do not invoke `prettier`, `eslint`, or `tsc` directly. Use the npm scripts above so configuration and file globs stay consistent.

## Fixing Diagnostics

### Important Rules

- All diagnostic warnings and errors must be resolved. The codebase must be completely free of warnings and errors.
- **Disabling diagnostics is strictly forbidden** without user permission: no `// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`, or similar directives.

**Typing:**

- TypeScript strict mode is enabled. Fix typing issues by addressing the root cause.
- Avoid the `any` type. Use proper types or generics instead.
- Type assertions (`as Type`) are discouraged but acceptable when strictly necessary (e.g. external library limitations).

### Process

1. **Understand the code**: read and understand what the code does and why the warning exists.
2. **Question the design**: understand the problem before jumping to a "quick fix".
3. **Fix the root cause**: address the actual problem, not the symptom.
4. **Verify**: run the diagnostic commands again until they are clean.
