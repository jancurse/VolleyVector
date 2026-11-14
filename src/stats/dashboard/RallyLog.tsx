import { memo } from "react";
import type { JSX } from "react";

import { Select } from "../../ui/Select";
import { cx, DATA_CELL, DATA_HEAD_CELL, THEM_TEXT, US_TEXT } from "../../ui/styles";
import { actionLabel, ALL } from "./data";
import type { MatchTables, RallyRow } from "./data";
import type { LogFilter, Params } from "./params";
import { VideoTime } from "./VideoTime";

/** One line of the log: a touch of ours, or the point that ended a rally none of our touches decided. */
type LogLine = { time: number; player: string; action: string; result: string; zone: string };

const NUM = "text-right";

/**
 * Every touch, grouped by rally like the tracker's event log: a rally's set, number, score, and server span its
 * touch rows. Filters sit in the column headers; a rally shows when any of its lines match, with only those
 * lines. On paper the same lines print grouped by player instead.
 */
function RallyLogTable({
  tables,
  p,
  up,
}: {
  tables: MatchTables;
  p: Params;
  up: (patch: Partial<Params>) => void;
}): JSX.Element {
  const info = new Map(tables.sets.map((s) => [s.id, s]));
  const byRally = new Map<string, LogLine[]>();

  for (const t of tables.touches) {
    const k = `${t.set}|${t.rally}`;

    byRally.set(k, [
      ...(byRally.get(k) ?? []),
      { time: t.time, player: t.player, action: actionLabel(t.skill), result: t.result, zone: t.zone },
    ]);
  }

  const rallies = tables.rallies
    .filter((r) => p.set === ALL || r.set === p.set)
    .map((r) => {
      const lines = [...(byRally.get(`${r.set}|${r.rally}`) ?? [])];

      if (r.endKind === "point")
        lines.push({
          time: r.end,
          player: "",
          action: "Point",
          result: [r.endReason, r.endNote].filter(Boolean).join(": ") || (r.winner === "us" ? "Us" : "Opponent"),
          zone: "",
        });

      return { r, lines };
    });
  const f = p.log;
  const fits = (filters: Record<LogFilter, string>) => (l: LogLine) =>
    (!filters.player || l.player === filters.player) &&
    (!filters.action || l.action === filters.action) &&
    (!filters.result || l.result === filters.result) &&
    (!filters.zone || l.zone === filters.zone);
  const lineFiltered = !!(f.player || f.action || f.result || f.zone);
  const shown = rallies
    .filter(({ r }) => !f.winner || r.winner === f.winner)
    .map(({ r, lines }) => ({ r, lines: lines.filter(fits(f)) }))
    .filter(({ lines }) => !lineFiltered || lines.length);
  // A column offers the values the other filters leave, so Result lists attack results once Action is Attack.
  const options = (key: Exclude<LogFilter, "winner">) => {
    const values = rallies
      .filter(({ r }) => !f.winner || r.winner === f.winner)
      .flatMap(({ lines }) => lines.filter(fits({ ...f, [key]: "" })).map((l) => l[key]));

    return [...new Set([...values, f[key]].filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((v) => ({ value: v, label: v }));
  };
  const filter = (key: LogFilter, label: string, values: { value: string; label: string }[]) => (
    <Select
      variant="column"
      ariaLabel={`Filter ${label}`}
      value={f[key]}
      onValueChange={(value) => up({ log: { ...f, [key]: value } })}
      options={[{ value: "", label }, ...values]}
    />
  );
  const lineCount = shown.reduce((n, x) => n + x.lines.length, 0);
  const byPlayer = new Map<string, { r: RallyRow; l: LogLine }[]>();

  for (const { r, lines } of shown)
    for (const l of lines) byPlayer.set(l.player, [...(byPlayer.get(l.player) ?? []), { r, l }]);

  const players = [...byPlayer.keys()].sort((a, b) => (!a ? 1 : !b ? -1 : a.localeCompare(b)));
  const rallyName = (r: RallyRow) => `${info.get(r.set)?.label.replace("Set ", "S") ?? ""} rally ${r.rally}`;
  const scoreCell = (r: RallyRow, rowSpan?: number) => (
    <td rowSpan={rowSpan} className={cx(DATA_CELL, NUM, "align-top", r.winner === "us" ? US_TEXT : THEM_TEXT)}>
      {r.scoreUs}–{r.scoreThem}
    </td>
  );

  return (
    <>
      <table className="hidden w-full border-collapse print:table" aria-label="Rally log by player">
        <thead>
          <tr>
            {["Player", "Rally", "Score", "Time", "Action", "Result", "Zone"].map((h) => (
              <th key={h} className={DATA_HEAD_CELL}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {players.map((name) => (
          <tbody key={name}>
            {(byPlayer.get(name) ?? []).map(({ r, l }, i) => (
              <tr key={i}>
                {/* Named on every row, so a group continued on the next page still says whose it is. */}
                <td className={cx(DATA_CELL, i > 0 && "text-text-dim")}>{name || "No touch"}</td>
                <td className={DATA_CELL}>{rallyName(r)}</td>
                {scoreCell(r)}
                <td className={cx(DATA_CELL, NUM)}>
                  <VideoTime videoId={info.get(r.set)?.videoId ?? null} time={l.time} />
                </td>
                <td className={DATA_CELL}>{l.action}</td>
                <td className={DATA_CELL}>{l.result}</td>
                <td className={cx(DATA_CELL, NUM)}>{l.zone}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <div className="max-h-rally-log overflow-auto print:hidden">
        <table className="w-full border-collapse" aria-label="Rally log">
          <thead>
            <tr>
              <th className={DATA_HEAD_CELL}>Rally</th>
              <th className={DATA_HEAD_CELL}>
                {filter("winner", "Score", [
                  { value: "us", label: "Won" },
                  { value: "them", label: "Lost" },
                ])}
              </th>
              <th className={DATA_HEAD_CELL}>Serve</th>
              <th className={cx(DATA_HEAD_CELL, NUM)}>Time</th>
              <th className={DATA_HEAD_CELL}>{filter("player", "Player", options("player"))}</th>
              <th className={DATA_HEAD_CELL}>{filter("action", "Action", options("action"))}</th>
              <th className={DATA_HEAD_CELL}>{filter("result", "Result", options("result"))}</th>
              <th className={DATA_HEAD_CELL}>{filter("zone", "Zone", options("zone"))}</th>
            </tr>
          </thead>
          {shown.map(({ r, lines }) => {
            const span = Math.max(1, lines.length);
            const videoId = info.get(r.set)?.videoId ?? null;

            return (
              <tbody key={`${r.set}|${r.rally}`}>
                {(lines.length ? lines : [null]).map((l, i) => (
                  <tr key={i} className={cx(i < span - 1 && "[&>td:not([rowspan])]:border-b-transparent")}>
                    {i === 0 && (
                      <>
                        <td rowSpan={span} className={cx(DATA_CELL, "align-top")}>
                          {rallyName(r)}
                        </td>
                        {scoreCell(r, span)}
                        <td rowSpan={span} className={cx(DATA_CELL, "align-top")}>
                          {r.serving === "us" ? "Us" : r.serving === "them" ? "Them" : ""}
                        </td>
                      </>
                    )}
                    <td className={cx(DATA_CELL, NUM)}>{l && <VideoTime videoId={videoId} time={l.time} />}</td>
                    <td className={DATA_CELL}>{l?.player}</td>
                    <td className={DATA_CELL}>{l?.action}</td>
                    <td className={DATA_CELL}>{l?.result}</td>
                    <td className={cx(DATA_CELL, NUM)}>{l?.zone}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
          <tfoot>
            <tr>
              <td colSpan={8} className="pt-2 text-xs text-text-dim">
                {shown.length} {shown.length === 1 ? "rally" : "rallies"}, {lineCount}{" "}
                {lineCount === 1 ? "line" : "lines"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}

/** The rally log, redrawn only when the tables or its own filters change, not on every other dashboard filter. */
export const RallyLog = memo(
  RallyLogTable,
  (a, b) => a.tables === b.tables && a.up === b.up && a.p.set === b.p.set && a.p.log === b.p.log
);
