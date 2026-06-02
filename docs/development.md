# Developer guide

## Tooling

| Tool         | Purpose                             | Config                                      |
|--------------|-------------------------------------|---------------------------------------------|
| Prettier     | Formatting at 120-char width        | `package.json`                              |
| ESLint       | Linting                             | `eslint.config.js`                          |
| TypeScript   | Type checking (`npm run typecheck`) | `tsconfig.json`                             |
| Vitest       | Testing with React Testing Library  | `vite.config.ts`, setup in `tests/setup.ts` |
| markdownlint | Markdown linting                    | `.markdownlint.yaml`                        |

## Initial Setup

- Install Node.js 22+.
- Run `npm install` to install dependencies. This also generates `package-lock.json`, which is committed and used by CI.
- Install the recommended VSCode extensions: Prettier, ESLint, and markdownlint.
- **Claude Code**: the repo enables tools that load automatically once you trust the project. Some need a binary installed once per machine:
    - `typescript-lsp` — TypeScript code intelligence. Needs the language server: `npm i -g typescript-language-server typescript` (global; reinstall after switching Node versions).
    - `playwright` — browser automation. Needs a browser: `npx playwright install chromium`.
    - `frontend-design` — frontend design guidance. No binary needed.

## Development

### Run in dev mode

Run `npm run dev` to start the Vite dev server at <http://localhost:5173> with hot module reloading.

### Deployment

Not yet implemented. To be filled later.

### Useful Commands

| Command                 | Description                                  |
|-------------------------|----------------------------------------------|
| `npm run dev`           | Start the Vite dev server on port 5173       |
| `npm run build`         | Type-check and build for production          |
| `npm run preview`       | Preview the production build locally         |
| `npm run format`        | Format `src`/`tests` with Prettier           |
| `npm run format:check`  | Check formatting without writing             |
| `npm run lint`          | Lint `src`/`tests` with ESLint               |
| `npm run lint:fix`      | Lint and auto-fix                            |
| `npm run typecheck`     | Type-check without emitting (`tsc --noEmit`) |
| `npm run test`          | Run the test suite once                      |
| `npm run test:watch`    | Run tests in watch mode                      |
| `npm run test:ui`       | Run tests with the Vitest UI                 |
| `npm run test:coverage` | Run tests with a coverage report             |
