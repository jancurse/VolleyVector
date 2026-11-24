import type { AppData, Rally } from "./types";

export const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return h ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`;
};

export const csvCell = (value: unknown): string => {
  const s = value == null ? "" : String(value);

  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One row per event, annotated with its rally context. */
export function flattenRows(rallies: Rally[]) {
  const rows = [];

  for (const r of rallies) {
    const events = [...r.subs, ...r.opponent, ...r.touches, ...(r.endedBy?.kind === "point" ? [r.endedBy] : [])];

    for (const e of events) {
      rows.push({
        rally: r.index,
        serving: r.serving ?? "",
        rotation: r.rotation,
        rallyWinner: r.winner ?? "",
        scoreUs: r.score.us,
        scoreThem: r.score.them,
        timestamp: e.timestamp,
        server: r.court?.positions[0] ?? "",
        ...(e.kind === "touch"
          ? {
              id: e.id,
              player: e.player,
              stat: e.stat,
              result: e.result,
              zone: e.zone,
              reason: e.reason ?? "",
              ...(e.type && { type: e.type }),
            }
          : e.kind === "sub"
            ? { id: e.id, player: e.in, stat: "sub", result: `for ${e.out}`, zone: "", reason: "" }
            : e.kind === "opponent"
              ? { id: e.id, player: "", stat: "opponent_serve", result: "", zone: "", reason: "" }
              : {
                  id: e.id,
                  player: "",
                  stat: e.winner === "us" ? "point_us" : "point_them",
                  result: e.reason ?? "",
                  zone: "",
                  reason: "",
                }),
      });
    }
  }

  return rows;
}

export function toJson(data: AppData, rallies: Rally[]): string {
  const rows = flattenRows(rallies);

  return JSON.stringify(
    {
      version: 2,
      metadata: { ...data.meta, youtubeUrl: data.meta.youtubeUrl || null, exportedAt: new Date().toISOString() },
      players: data.players,
      events: data.events,
      ...(data.draft && { draft: data.draft }),
      // Every touch as a flat row, for reading the export without deriving rallies.
      stats: rows.filter((r) => !r.stat.startsWith("point_") && r.stat !== "sub" && r.stat !== "opponent_serve"),
      rallies: rallies
        .filter((r) => r.winner)
        .map((r) => ({
          index: r.index,
          startTime: r.startTime,
          endTime: r.endTime,
          serving: r.serving,
          rotation: r.rotation,
          court: r.court,
          winner: r.winner,
          scoreUs: r.score.us,
          scoreThem: r.score.them,
          touches: r.touches.length,
        })),
    },
    null,
    2
  );
}

/** One line per event. The Type column is there only when a touch has one, so other sets' files stay as they were. */
export function toCsv(rallies: Rally[]): string {
  const flat = flattenRows(rallies);
  const type = (r: (typeof flat)[number]) => ("type" in r && r.type) || "";
  const typed = flat.some(type);
  const headers = [
    "Time",
    "Seconds",
    "Rally",
    "Serving",
    "Rotation",
    "Server",
    "Player",
    "Stat",
    ...(typed ? ["Type"] : []),
    "Result",
    "Reason",
    "Zone",
    "Rally winner",
    "Score us",
    "Score them",
  ];
  const rows = flat.map((r) => [
    formatTime(r.timestamp),
    r.timestamp.toFixed(2),
    r.rally,
    r.serving,
    r.rotation,
    r.server,
    r.player,
    r.stat,
    ...(typed ? [type(r)] : []),
    r.result,
    r.reason,
    r.zone,
    r.rallyWinner,
    r.scoreUs,
    r.scoreThem,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function exportFilename(data: AppData, ext: string): string {
  const parts = [
    data.meta.homeTeam,
    data.meta.awayTeam,
    data.meta.setNumber ? `set${data.meta.setNumber}` : "",
    data.meta.date,
  ]
    .map((p) => p.trim().replace(/[^\w-]+/g, "_"))
    .filter(Boolean);

  return `volleyball_stats_${parts.join("_") || "export"}.${ext}`;
}
