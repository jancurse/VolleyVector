import Chart from "chart.js/auto";
import type { ChartConfiguration, ChartType } from "chart.js";

import type { CanvasChart } from "./chartGenerator";
import { outcomeLabel } from "./outcomeLabel";
import { resolveColor } from "./resolveColor";

/** Pixels drawn per CSS pixel, so a chart stays sharp on screen, on paper, and scaled down. */
const DENSITY = 2;

/** Option keys that are lengths in CSS pixels, so they scale with the drawing density. */
const SCALED = new Set(["size", "boxWidth", "boxHeight", "padding"]);

/**
 * Draw `chart` on `canvas` at twice the size it is laid out at, in the theme `canvas` sits in: Chart.js charts with
 * the theme's text, gridlines, font, and palette, outcomes by their tracker names; court charts by their own
 * drawing. Returns a cleanup that destroys the Chart.js instance.
 */
export function drawChart(canvas: HTMLCanvasElement, chart: CanvasChart): () => void {
  // The canvas fills a box laid out to the chart's shape; draw at that box's size.
  const box = canvas.parentElement ?? canvas;

  if (box.clientWidth) {
    canvas.width = Math.round(box.clientWidth * DENSITY);
    canvas.height = Math.round(box.clientHeight * DENSITY) || canvas.width;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) return () => undefined;

  const resolve = (css: string) => resolveColor(canvas, css);

  if (chart.type === "custom") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chart.customDraw?.(ctx, chart, resolve);

    return () => undefined;
  }

  const colour = (c: string | string[] | undefined) => (Array.isArray(c) ? c.map(resolve) : c && resolve(c));

  // Text, gridlines, and fonts in the theme and the app's font, at the app's small text size.
  Chart.defaults.font = { ...Chart.defaults.font, family: getComputedStyle(canvas).fontFamily, size: 12 * DENSITY };
  Chart.defaults.color = resolve("var(--text-dim)");
  Chart.defaults.borderColor = resolve("var(--border)");

  const scaled = scaleFonts(chart.options ?? {});
  const instance = new Chart(ctx, {
    type: chart.type as ChartType,
    data: {
      labels: chart.data.labels.map(outcomeLabel),
      datasets: chart.data.datasets.map((d) => ({
        ...d,
        label: outcomeLabel(d.label),
        backgroundColor: colour(d.backgroundColor),
        borderColor: colour(d.borderColor),
      })),
    },
    options: {
      ...scaled,
      // Drawn once at the canvas's size and scaled by CSS, so the screen, the PDF, and the HTML match.
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        ...scaled.plugins,
        title: { display: false },
        // Chart.js colours a pie's key from its own label defaults, not Chart.defaults.color: set the theme text.
        legend: {
          ...scaled.plugins?.legend,
          labels: { ...scaled.plugins?.legend?.labels, color: resolve("var(--text-dim)") },
          // A pie's key beside it may take more than Chart.js's default half of the width, so long outcome names
          // ("Blocked, in play") are not cut off.
          ...(chart.type === "doughnut" && { maxWidth: canvas.width * 0.6 }),
        },
      },
    },
  } as ChartConfiguration);

  return () => instance.destroy();
}

/** The chart's options with every font size, legend box width, and padding it sets scaled to the drawing density. */
function scaleFonts<T>(value: T): T {
  if (Array.isArray(value)) return value.map(scaleFonts) as T;
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SCALED.has(k) && typeof v === "number" ? v * DENSITY : typeof v === "function" ? v : scaleFonts(v),
    ])
  ) as T;
}
