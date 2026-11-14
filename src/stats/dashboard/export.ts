import type { ReportSet } from "../types";
import { matchTables } from "./data";
import type { Params } from "./params";

/** Keeps inlined text from closing the element it sits in. */
const inline = (text: string) => text.replace(/<\/(script|style)/gi, "<\\/$1");

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** The dashboard bundled into one script and stylesheet (the standalone-dashboard plugin in vite.config.ts), fetched once. */
let assets: Promise<{ js: string; css: string }> | undefined;

export function standaloneAssets(): Promise<{ js: string; css: string }> {
  const get = async (ext: string) => {
    const res = await fetch(`/standalone/dashboard.${ext}`);

    // A host that answers every unknown path with the app's page says 200 for a missing build.
    if (!res.ok || res.headers.get("content-type")?.includes("text/html"))
      throw new Error(`Could not load the dashboard for export (${res.status})`);

    return res.text();
  };

  assets ??= Promise.all([get("js"), get("css")]).then(([js, css]) => ({ js, css }));
  assets.catch(() => (assets = undefined));

  return assets;
}

/** The app's fonts, as index.html loads them. The exported page falls back to system fonts offline. */
export const FONTS =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap";

/** A single offline HTML file with the dashboard and its data, opening on the view `params` describes. */
export async function dashboardHtml(sets: ReportSet[], params?: Params): Promise<string> {
  const { js, css } = await standaloneAssets();
  const title = dashboardTitle(sets);
  const json = (v: unknown) => JSON.stringify(v ?? null).replace(/</g, "\\u003c");

  // The app's fonts (online), its built stylesheet, and the theme: the viewer's light or dark setting on
  // screen, light on paper.
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>${inline(css)}</style>
</head>
<body>
<div id="root"></div>
<script>window.__SETS__ = ${json(sets)}; window.__PARAMS__ = ${json(params)};</script>
<script>${inline(js)}</script>
</body>
</html>
`;
}

/** "Opal v Pumas 2026-10-03", for the page title and file name. */
export function dashboardTitle(sets: ReportSet[]): string {
  const { sets: info } = matchTables(sets);
  const first = info[0];
  const matches = new Set(info.map((s) => s.match));

  return matches.size > 1
    ? `Stats, ${matches.size} matches`
    : [[first?.home, first?.away].filter(Boolean).join(" vs "), first?.date].filter(Boolean).join(" ") || "Stats";
}

export const dashboardFilename = (sets: ReportSet[]) => `${dashboardTitle(sets).replace(/[^\w-]+/g, "_")}_stats.html`;
