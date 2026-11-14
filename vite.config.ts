/// <reference types="vitest/config" />
// Vite configuration: compiles TypeScript/React, runs the dev server, and configures Vitest.
import { build, defineConfig } from "vite";
import type { Plugin } from "vite";
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
// under Vite's 500 kB warning. The set report's libraries (chart.js, jspdf, html2canvas) load only with the
// report, and the extras jspdf imports on demand are left for Rollup to split. Of the rest, anything in
// node_modules that is not react, @base-ui, or motion belongs to react-markdown's subtree.
function manualChunks(id: string): string | undefined {
  // Vite's preload helper is used by every lazy import; left alone, Rollup puts it in the first chunk that
  // needs it (jspdf's), and the app would load jspdf up front to get it.
  if (id.includes("vite/preload-helper")) return "react";
  if (!id.includes("node_modules")) return undefined;
  if (/[\\/]node_modules[\\/](chart\.js|@kurkle)[\\/]/.test(id)) return "charts";
  if (/[\\/]node_modules[\\/]jspdf[\\/]/.test(id)) return "jspdf";
  if (/[\\/]node_modules[\\/](html2canvas|text-segmentation|utrie|css-line-break|base64-arraybuffer)[\\/]/.test(id))
    return "html2canvas";
  if (
    /[\\/]node_modules[\\/](canvg|dompurify|core-js|raf|rgbcolor|stackblur-canvas|svg-pathdata|performance-now|fflate|@babel)[\\/]/.test(
      id
    )
  )
    return undefined;
  if (id.includes("@base-ui")) return "base-ui";
  if (/[\\/]node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return "motion";
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return "react";

  return "react-markdown";
}

// The stats dashboard as one script and one stylesheet (the app's own, built by Tailwind), which the app
// inlines into its HTML export so the file works offline. `npm run build` builds it as a second entry into
// dist/standalone/; the dev server builds it on first request.
function standaloneDashboard(): Plugin {
  const bundle = async (): Promise<{ js: string; css: string }> => {
    const result = await build({
      configFile: false,
      logLevel: "warn",
      mode: "production",
      // The app's stylesheet comes along, built by Tailwind from the same sources as the app.
      plugins: [tailwindcss()],
      // The production JSX runtime, even when the dev server builds it (where NODE_ENV is development).
      esbuild: { jsx: "automatic", jsxDev: false },
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        write: false,
        minify: true,
        // Libraries' "use client" lines mean nothing in a browser bundle; the app build drops them quietly too.
        rollupOptions: {
          onwarn: (warning, warn) => warning.code !== "MODULE_LEVEL_DIRECTIVE" && warn(warning),
        },
        lib: {
          entry: "src/stats/dashboard/standalone.tsx",
          formats: ["iife"],
          name: "VolleyVectorStats",
          fileName: () => "dashboard.js",
          cssFileName: "dashboard",
        },
      },
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
    const chunk = output.find((o) => o.type === "chunk");
    const style = output.find((o) => o.type === "asset" && o.fileName.endsWith(".css"));

    return {
      js: chunk?.type === "chunk" ? chunk.code : "",
      css: style?.type === "asset" ? String(style.source) : "",
    };
  };
  let served: Promise<{ js: string; css: string }> | undefined;

  return {
    name: "standalone-dashboard",
    configureServer(server) {
      // A change to any source rebuilds it on the next request, so a download never carries a stale build.
      server.watcher.on("change", () => (served = undefined));
      server.middlewares.use((req, res, next) => {
        const ext = req.url?.match(/^\/standalone\/dashboard\.(js|css)$/)?.[1] as "js" | "css" | undefined;

        if (!ext) return next();

        served ??= bundle();
        served.then(
          (assets) => {
            res.setHeader("content-type", ext === "js" ? "text/javascript" : "text/css");
            res.end(assets[ext]);
          },
          (error: unknown) => next(error)
        );
      });
    },
    async generateBundle() {
      const { js, css } = await bundle();

      this.emitFile({ type: "asset", fileName: "standalone/dashboard.js", source: js });
      this.emitFile({ type: "asset", fileName: "standalone/dashboard.css", source: css });
    },
  };
}

export default defineConfig(({ command }) => {
  if (command === "serve") loadDevCredentials();
  // One locale and time zone for every test run, set before Vitest starts its workers, so CI and every machine
  // format dates the same.
  if (process.env.VITEST) Object.assign(process.env, { LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8", TZ: "UTC" });

  return {
    plugins: [react(), tailwindcss(), standaloneDashboard()],
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
