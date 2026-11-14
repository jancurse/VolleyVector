/** The report's charts: Chart.js definitions per action, plus court charts drawn on the canvas directly. */

import type { Stat, ScoreRecord } from "./statsAnalyzer";
import type { ChartOptions, ChartType, TooltipItem } from "chart.js";

import { outcomeLabel } from "./outcomeLabel";
import { OPPONENT_ERROR_LABELS, getTeamStats, getOpponentStats } from "./statsAnalyzer";

// The palette: the outcome colours, one hue per quality level, from the --outcome-* tokens in index.css.
const COLOR_PALETTE = {
  excellent: "var(--outcome-excellent)",
  great: "var(--outcome-great)",
  ok: "var(--outcome-ok)",
  okDark: "var(--outcome-ok-dark)",
  error: "var(--outcome-error)",
  badDark: "var(--outcome-bad)",
  badDarkest: "var(--outcome-bad-darkest)",
  neutral: "var(--outcome-neutral)",
} as const;

/** Known keys stay typed as string; arbitrary lookups may be undefined. */
const palette = <T extends Record<string, string>>(m: T): T & Record<string, string> => m;

// Outcome to quality mapping for consistent coloring
const serveColors = palette({
  ace: COLOR_PALETTE.excellent,
  dig01: COLOR_PALETTE.great,
  dig23: COLOR_PALETTE.ok,
  net: COLOR_PALETTE.badDark,
  out: COLOR_PALETTE.neutral,
  error: COLOR_PALETTE.error,
});

const receiveDefenseColors = palette({
  dig23: COLOR_PALETTE.great,
  dig01: COLOR_PALETTE.ok,
  error: COLOR_PALETTE.error,
  net: COLOR_PALETTE.badDark,
  out: COLOR_PALETTE.neutral,
});

const attackColors = palette({
  kill: COLOR_PALETTE.excellent,
  defended: COLOR_PALETTE.ok,
  block_inplay: COLOR_PALETTE.okDark,
  block_tool: COLOR_PALETTE.great,
  net: COLOR_PALETTE.badDark,
  out: COLOR_PALETTE.neutral,
  block_kill: COLOR_PALETTE.badDarkest,
  error: COLOR_PALETTE.error,
});

const setColors = palette({
  on: COLOR_PALETTE.excellent,
  off: COLOR_PALETTE.ok,
  over_defended: COLOR_PALETTE.okDark,
  over_score: COLOR_PALETTE.great,
});

const blockColors = palette({
  touch: COLOR_PALETTE.great,
  tool: COLOR_PALETTE.error,
  net: COLOR_PALETTE.badDark,
  error: COLOR_PALETTE.error,
  kill: COLOR_PALETTE.excellent,
  block_kill: COLOR_PALETTE.badDarkest,
  out: COLOR_PALETTE.neutral,
});

type ChartDataset = {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string;
  borderWidth?: number;
  tension?: number;
};

type ChartData = {
  labels: string[];
  datasets: ChartDataset[];
};

// Sort labels to group error outcomes (out, net, error) together at the end
function sortLabelsWithErrorsLast(labels: string[]): string[] {
  const errorTypes = ["out", "net", "error"];
  const errors = labels.filter((l) => errorTypes.includes(l));
  const nonErrors = labels.filter((l) => !errorTypes.includes(l));

  // Sort errors in consistent order
  const errorOrder = ["error", "net", "out"];

  errors.sort((a, b) => errorOrder.indexOf(a) - errorOrder.indexOf(b));

  return [...nonErrors, ...errors];
}

export type CanvasChart = {
  type: "bar" | "line" | "doughnut" | "custom";
  data: ChartData;
  options?: ChartOptions;
  /** Draws a chart Chart.js has no type for; `resolve` turns the palette's CSS into a canvas colour. */
  customDraw?: (ctx: CanvasRenderingContext2D, chart: CanvasChart, resolve: (css: string) => string) => void;
};

function createBarChart(labels: string[], dataValues: number[], title: string, color: string): CanvasChart {
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: title,
          data: dataValues,
          backgroundColor: color,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
        },
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };
}

/** A see-through tint of a palette colour, for the fill under a line's points. */
const tint = (color: string): string => `color-mix(in srgb, ${color} 12%, transparent)`;

function createLineChart(
  labels: string[],
  dataset1: { label: string; data: number[]; color: string },
  dataset2: { label: string; data: number[]; color: string },
  title: string
): CanvasChart {
  return {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: dataset1.label,
          data: dataset1.data,
          borderColor: dataset1.color,
          backgroundColor: tint(dataset1.color),
          tension: 0.1,
        },
        {
          label: dataset2.label,
          data: dataset2.data,
          borderColor: dataset2.color,
          backgroundColor: tint(dataset2.color),
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
        },
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };
}

function createZoneCourtChart(
  zoneData: Record<string, { total: number; results: Record<string, number> }>,
  resultLabels: string[],
  title: string
): CanvasChart {
  // Court layout:
  // 4  3  2
  // 7  8  9
  // 5  6  1
  const zoneLayout = [
    [4, 3, 2],
    [7, 8, 9],
    [5, 6, 1],
  ];

  return {
    type: "custom",
    data: {
      labels: resultLabels,
      datasets: [],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
        },
        legend: {
          display: true,
          position: "top",
        },
      },
    },
    customDraw: (ctx: CanvasRenderingContext2D, _chart: CanvasChart, resolve: (css: string) => string) => {
      const font = getComputedStyle(ctx.canvas).fontFamily;
      // The drawing's sizes are for a 600px canvas, scaled to the canvas's actual width.
      const k = ctx.canvas.width / 600;
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      const padding = 50 * k;
      const courtWidth = width - 2 * padding;
      const courtHeight = height - 2 * padding;
      const cellWidth = courtWidth / 3;
      const cellHeight = courtHeight / 3;

      // Find max total for color scaling
      let maxTotal = 0;

      for (const zone in zoneData) {
        maxTotal = Math.max(maxTotal, zoneData[zone]?.total ?? 0);
      }
      if (maxTotal === 0) maxTotal = 1;

      // Helper function to interpolate color based on intensity
      // A light accent tint that deepens with the zone's share (kept light enough for the text on it).
      const getHeatmapColor = (value: number, max: number): string =>
        resolve(`color-mix(in srgb, var(--accent) ${Math.round(8 + 32 * (value / max))}%, var(--bg))`);

      // Draw zones
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const zone = String(zoneLayout[row]?.[col]);
          const x = padding + col * cellWidth;
          const y = padding + row * cellHeight;
          const stats = zoneData[zone];
          const total = stats ? stats.total : 0;

          // Zone background - color based on intensity
          ctx.fillStyle = getHeatmapColor(total, maxTotal);
          ctx.strokeStyle = resolve("var(--text)");
          ctx.lineWidth = 2 * k;
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.strokeRect(x, y, cellWidth, cellHeight);

          // Zone number - faint in corner
          ctx.fillStyle = resolve("color-mix(in srgb, var(--text) 30%, transparent)");
          ctx.font = `bold ${Math.round(28 * k)}px ${font}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(zone, x + 8 * k, y + 8 * k);

          // Zone stats - centered
          if (stats) {
            const totalLines = resultLabels.length + 1; // +1 for total
            let contentY = y + cellHeight / 2 - (totalLines * 28 * k) / 2 + 8 * k;

            ctx.font = `bold ${Math.round(20 * k)}px ${font}`;
            ctx.textAlign = "center";
            ctx.fillStyle = resolve("var(--text)");

            // Display total attempts first
            ctx.fillText(`Total: ${stats.total}`, x + cellWidth / 2, contentY);
            contentY += 28 * k;

            // Display each result
            ctx.font = `${Math.round(18 * k)}px ${font}`;
            for (const result of resultLabels) {
              const count = stats.results[result] || 0;

              ctx.fillText(`${outcomeLabel(result)}: ${count}`, x + cellWidth / 2, contentY);
              contentY += 28 * k;
            }
          }
        }
      }
    },
  };
}

/** One skill's outcomes on a court of zones; `anyZone` also counts touches with no zone (blocks). */
function zoneChart(
  stats: Stat[],
  skill: string,
  resultTypes: readonly string[],
  title: string,
  anyZone = false
): CanvasChart | null {
  const touches = getTeamStats(stats).filter((s) => s.stat === skill && (anyZone || s.zone !== "0"));

  if (touches.length === 0) return null;

  const zoneData: Record<string, { total: number; results: Record<string, number> }> = {};

  for (const { zone, result } of touches) {
    const data = (zoneData[zone] ??= { total: 0, results: {} });

    data.total++;
    data.results[result] = (data.results[result] ?? 0) + 1;
  }

  return createZoneCourtChart(
    zoneData,
    resultTypes.filter((r) => Object.values(zoneData).some((z) => z.results[r])),
    title
  );
}

export const chartServes = (stats: Stat[]): CanvasChart | null =>
  zoneChart(stats, "serve", ["ace", "dig01", "dig23"], "Serve Outcomes per Zone");

export const chartAttacks = (stats: Stat[]): CanvasChart | null =>
  zoneChart(
    stats,
    "attack",
    ["kill", "defended", "block_kill", "block_tool", "block_inplay"],
    "Attack Outcomes per Zone"
  );

export const chartSets = (stats: Stat[]): CanvasChart | null =>
  zoneChart(stats, "set", ["on", "off", "over_score", "over_defended"], "Sets per Zone");

export const chartReceive = (stats: Stat[]): CanvasChart | null =>
  zoneChart(stats, "receive", ["dig01", "dig23", "error"], "Receive Outcomes per Zone");

export const chartDefense = (stats: Stat[]): CanvasChart | null =>
  zoneChart(stats, "defense", ["dig01", "dig23", "error"], "Defense Outcomes per Zone");

export const chartBlocks = (stats: Stat[]): CanvasChart | null =>
  zoneChart(stats, "block", ["kill", "touch", "net", "tool"], "Block Outcomes per Zone", true);

export function chartOpponentErrors(stats: Stat[]): [CanvasChart | null, number] {
  // One "opponent" row per point we won that none of our touches decided.
  const opp_errors = getOpponentStats(stats);

  if (opp_errors.length === 0) {
    return [null, 0];
  }

  const errorCounts: Record<string, number> = {};

  for (const stat of opp_errors) {
    const label = OPPONENT_ERROR_LABELS[stat.stat] ?? stat.stat;

    errorCounts[label] = (errorCounts[label] || 0) + 1;
  }

  const labels = Object.keys(errorCounts);
  const data = labels.map((label) => errorCounts[label] ?? 0);

  const chart = createBarChart(labels, data, "Opponent Errors (Points Given to Us)", COLOR_PALETTE.great);

  return [chart, opp_errors.length];
}

export function chartScoresOverTime(scores: ScoreRecord[]): CanvasChart | null {
  if (!scores.length) {
    return null;
  }

  const timestamps = scores.map((s) => String(s.timestamp));
  const ourScores = scores.map((s) => s.our_score);
  const oppScores = scores.map((s) => s.opp_score);

  const chart = createLineChart(
    timestamps,
    { label: "Our Team", data: ourScores, color: COLOR_PALETTE.excellent },
    { label: "Opponent", data: oppScores, color: COLOR_PALETTE.okDark },
    "Score Progression Over Time"
  );

  // Hide x-axis labels
  if (chart.options && chart.options.scales) {
    chart.options.scales.x = {
      ticks: {
        display: false,
      },
    };
  }

  return chart;
}

/** One skill's outcomes as shares of a ring, errors last. */
function pieChart(stats: Stat[], skill: string, colors: Record<string, string>, title: string): CanvasChart | null {
  const touches = getTeamStats(stats).filter((s) => s.stat === skill);

  if (touches.length === 0) {
    return null;
  }

  const resultCounts: Record<string, number> = {};

  for (const stat of touches) {
    resultCounts[stat.result] = (resultCounts[stat.result] || 0) + 1;
  }

  const labels = sortLabelsWithErrorsLast(Object.keys(resultCounts));
  const data = labels.map((label) => resultCounts[label] ?? 0);
  const backgroundColor = labels.map((label) => colors[label] || COLOR_PALETTE.neutral);

  return {
    type: "doughnut",
    data: {
      labels: labels.map((label, i) => `${label}: ${data[i]}`),
      datasets: [
        {
          label: title,
          data,
          backgroundColor,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: "right",
          align: "center",
          labels: {
            boxWidth: 12,
            padding: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            label: function (context: TooltipItem<ChartType>) {
              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const percentage = ((Number(context.parsed) / total) * 100).toFixed(1);

              return `${context.label}: ${percentage}%`;
            },
          },
        },
      },
    },
  };
}

export const chartServesPie = (stats: Stat[]): CanvasChart | null =>
  pieChart(stats, "serve", serveColors, "Serve Outcomes");

export const chartAttacksPie = (stats: Stat[]): CanvasChart | null =>
  pieChart(stats, "attack", attackColors, "Attack Outcomes");

export const chartSetsPie = (stats: Stat[]): CanvasChart | null => pieChart(stats, "set", setColors, "Set Outcomes");

export const chartReceivePie = (stats: Stat[]): CanvasChart | null =>
  pieChart(stats, "receive", receiveDefenseColors, "Receive Outcomes");

export const chartDefensePie = (stats: Stat[]): CanvasChart | null =>
  pieChart(stats, "defense", receiveDefenseColors, "Defense Outcomes");

export const chartBlocksPie = (stats: Stat[]): CanvasChart | null =>
  pieChart(stats, "block", blockColors, "Block Outcomes");

export function chartAttacksPerPlayer(stats: Stat[]): CanvasChart | null {
  const teamStats = getTeamStats(stats);
  const attackStats = teamStats.filter((s) => s.stat === "attack");

  if (attackStats.length === 0) {
    return null;
  }

  // Group by player and count outcomes
  const playerStats: Record<string, Record<string, number>> = {};

  for (const stat of attackStats) {
    const tally = (playerStats[stat.player] ??= {});

    tally[stat.result] = (tally[stat.result] || 0) + 1;
  }

  const players = Object.keys(playerStats).sort();
  const resultTypes = ["kill", "defended", "block_kill", "block_tool", "block_inplay", "error", "net", "out"];
  const colorMap = attackColors;

  const datasets: ChartDataset[] = resultTypes.map((result) => ({
    label: result,
    data: players.map((player) => playerStats[player]?.[result] || 0),
    backgroundColor: colorMap[result] || COLOR_PALETTE.neutral,
  }));

  return {
    type: "bar",
    data: {
      labels: players,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Attack Outcomes per Player",
        },
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
        },
      },
    },
  };
}

export function chartServePerPlayer(stats: Stat[]): CanvasChart | null {
  const teamStats = getTeamStats(stats);
  const serveStats = teamStats.filter((s) => s.stat === "serve");

  if (serveStats.length === 0) {
    return null;
  }

  // Group by player and count outcomes
  const playerStats: Record<string, Record<string, number>> = {};

  for (const stat of serveStats) {
    const tally = (playerStats[stat.player] ??= {});

    tally[stat.result] = (tally[stat.result] || 0) + 1;
  }

  const players = Object.keys(playerStats).sort();
  const resultTypes = ["ace", "dig01", "dig23", "error", "net", "out"];
  const colorMap = serveColors;

  const datasets: ChartDataset[] = resultTypes.map((result) => ({
    label: result,
    data: players.map((player) => playerStats[player]?.[result] || 0),
    backgroundColor: colorMap[result] || COLOR_PALETTE.neutral,
  }));

  return {
    type: "bar",
    data: {
      labels: players,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Serve Outcomes per Player",
        },
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
        },
      },
    },
  };
}

/** Stacked bar of one skill's outcomes per player. `key` picks the bar segment for a stat. */
function outcomesPerPlayer(
  stats: Stat[],
  skill: string,
  title: string,
  resultTypes: string[],
  colorMap: Record<string, string>,
  key: (s: Stat) => string = (s) => s.result
): CanvasChart | null {
  const skillStats = getTeamStats(stats).filter((s) => s.stat === skill);

  if (skillStats.length === 0) return null;

  const playerStats: Record<string, Record<string, number>> = {};

  for (const stat of skillStats) {
    const tally = (playerStats[stat.player] ??= {});

    tally[key(stat)] = (tally[key(stat)] || 0) + 1;
  }

  const players = Object.keys(playerStats).sort();
  // Only show outcomes that actually occurred, to keep the legend short.
  const shown = resultTypes.filter((r) => players.some((p) => playerStats[p]?.[r]));

  return {
    type: "bar",
    data: {
      labels: players,
      datasets: shown.map((result) => ({
        label: result,
        data: players.map((player) => playerStats[player]?.[result] || 0),
        backgroundColor: colorMap[result] || COLOR_PALETTE.neutral,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: title },
        legend: { display: true, position: "top" },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true },
      },
    },
  };
}

export function chartReceivePerPlayer(stats: Stat[]): CanvasChart | null {
  return outcomesPerPlayer(
    stats,
    "receive",
    "Receive Outcomes per Player",
    ["dig01", "dig23", "error", "net", "out"],
    receiveDefenseColors
  );
}

export function chartDefensePerPlayer(stats: Stat[]): CanvasChart | null {
  // Errors tagged with a reason (e.g. positioning) get their own segment.
  return outcomesPerPlayer(
    stats,
    "defense",
    "Defense Outcomes per Player",
    ["dig23", "dig01", "error", "error: positioning"],
    { ...receiveDefenseColors, "error: positioning": COLOR_PALETTE.badDark },
    (s) => (s.result === "error" && s.reason ? `error: ${s.reason}` : s.result)
  );
}

export function chartSetsByZonePerPlayer(stats: Stat[]): CanvasChart | null {
  const teamStats = getTeamStats(stats);
  const setStats = teamStats.filter((s) => s.stat === "set" && s.zone !== "0");

  if (setStats.length === 0) {
    return null;
  }

  // Group by player and zone, count outcomes
  const playerZoneStats: Record<string, Record<string, number>> = {};

  for (const stat of setStats) {
    const tally = (playerZoneStats[stat.player] ??= {});

    tally[stat.zone] = (tally[stat.zone] || 0) + 1;
  }

  const players = Object.keys(playerZoneStats).sort();
  const zones = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((z) =>
    players.some((p) => playerZoneStats[p]?.[z])
  );

  const colorMap: Record<string, string> = {
    "1": COLOR_PALETTE.excellent,
    "2": COLOR_PALETTE.great,
    "3": "color-mix(in srgb, var(--accent) 30%, var(--bg))",
    "4": COLOR_PALETTE.ok,
    "5": COLOR_PALETTE.okDark,
    "6": "color-mix(in srgb, var(--text) 60%, var(--bg))",
    "7": COLOR_PALETTE.badDark,
    "8": COLOR_PALETTE.error,
    "9": COLOR_PALETTE.badDarkest,
  };

  const datasets: ChartDataset[] = zones.map((zone) => ({
    label: `Zone ${zone}`,
    data: players.map((player) => playerZoneStats[player]?.[zone] || 0),
    backgroundColor: colorMap[zone] || COLOR_PALETTE.neutral,
  }));

  return {
    type: "bar",
    data: {
      labels: players,
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Set Zone Distribution per Player",
        },
        legend: {
          display: true,
          position: "top",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          beginAtZero: true,
        },
      },
    },
  };
}
