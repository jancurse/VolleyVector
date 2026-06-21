/// <reference types="vitest/config" />
// Vite configuration: compiles TypeScript/React, runs the dev server, and configures Vitest.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Dev-only quick sign-in, so the dev server (and Playwright) come up signed in and a developer can switch
// accounts from the gate. It runs only in `serve`, so the credentials never reach a production build, and
// Vite exposes VITE_DEV_ACCOUNTS (a JSON array of { label, email, password }) on import.meta.env. The first
// entry is the default the app auto-logs-in as. Against the local stack (npm run dev / dev:migrate, which
// export a 127.0.0.1 Supabase URL) we list the three seeded accounts (mirrors supabase/seed.sql) with no
// setup. Against any remote database (npm run dev:prod) we read personal accounts from one machine-level
// file outside the repo, so every worktree shares a copy and no secret is committed.
function loadDevCredentials(): void {
  const url = process.env.VITE_SUPABASE_URL ?? "";

  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    process.env.VITE_DEV_ACCOUNTS = JSON.stringify([
      { label: "Coach", email: "coach@volleyvector.test", password: "password" },
      { label: "Player", email: "player@volleyvector.test", password: "password" },
      { label: "Admin", email: "admin@volleyvector.test", password: "password" },
    ]);

    return;
  }

  const file = join(homedir(), ".config", "volleyvector", "dev.env");

  if (!existsSync(file)) return;

  // Each account is a (label, email, password) triple keyed by an optional label segment:
  // VITE_DEV_<LABEL>_EMAIL / VITE_DEV_<LABEL>_PASSWORD, with the legacy unlabelled VITE_DEV_EMAIL /
  // VITE_DEV_PASSWORD pair read as "Dev Coach". Entries keep file order; the first is the auto-login.
  const byLabel = new Map<string, { email?: string; password?: string }>();

  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");

    if (eq === -1) continue;
    const match = trimmed
      .slice(0, eq)
      .trim()
      .match(/^VITE_DEV_(?:([A-Za-z0-9]+)_)?(EMAIL|PASSWORD)$/);

    if (!match) continue;
    const label = match[1] ? `Dev ${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}` : "Dev Coach";
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    const entry = byLabel.get(label) ?? {};

    entry[match[2] === "EMAIL" ? "email" : "password"] = value;
    byLabel.set(label, entry);
  }

  const accounts = [...byLabel].flatMap(([label, { email, password }]) =>
    email && password ? [{ label, email, password }] : []
  );

  if (accounts.length > 0) process.env.VITE_DEV_ACCOUNTS = JSON.stringify(accounts);
}

// Split the heavy vendors into their own chunks so they cache independently and the app chunk stays
// under Vite's 500 kB warning. Our only runtime deps are react, @base-ui, motion, and react-markdown,
// so anything in node_modules that is not one of the first three belongs to react-markdown's subtree.
function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("@base-ui")) return "base-ui";
  if (/[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return "motion";
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";

  return "react-markdown";
}

export default defineConfig(({ command }) => {
  if (command === "serve") loadDevCredentials();

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: { manualChunks },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
    },
    test: {
      globals: true,
      environment: "happy-dom",
      setupFiles: ["./tests/setup.ts"],
      include: ["tests/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        reportsDirectory: ".coverage",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.d.ts", "src/main.tsx", "src/vite-env.d.ts"],
      },
    },
  };
});
