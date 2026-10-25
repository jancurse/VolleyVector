import { secondaryOf } from "./rotation";
import type { PlayerDraft } from "./useRoster";
import type { Position, RosterPlayer } from "./types";

// One player per line: number, name, optional short name, main, optional secondaries (joined by "/"), split
// by tab, comma, or semicolon. A first line with neither a number nor a known main position is a header.

export type ImportRow = { line: number; text: string } & ({ draft: PlayerDraft } | { error: string });

const ALIASES: Record<string, Position> = {
  s: "setter",
  setter: "setter",
  oh: "outside",
  outside: "outside",
  "outside hitter": "outside",
  mb: "middle",
  middle: "middle",
  "middle blocker": "middle",
  opp: "opposite",
  op: "opposite",
  opposite: "opposite",
  l: "libero",
  lib: "libero",
  libero: "libero",
};

const position = (cell: string | undefined): Position | null | undefined =>
  !cell?.trim() ? null : ALIASES[cell.trim().toLowerCase()];

function splitLine(line: string, delimiter: string): string[] {
  const cells = [""];
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"' && quoted && line[i + 1] === '"') cells[cells.length - 1] += line[++i];
    else if (line[i] === '"') quoted = !quoted;
    else if (line[i] === delimiter && !quoted) cells.push("");
    else cells[cells.length - 1] += line[i];
  }

  return cells.map((c) => c.trim());
}

export function parseRoster(text: string, roster: readonly RosterPlayer[]): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((t, i) => ({ text: t, line: i + 1 }))
    .filter(({ text: t }) => t.trim() !== "");
  const delimiter = /\t/.test(text) ? "\t" : /;/.test(text) && !/,/.test(text) ? ";" : ",";
  const taken = new Set(roster.filter((p) => !p.archived).map((p) => p.number));
  const cells = (t: string) => splitLine(t, delimiter);
  const first = lines.length > 0 ? cells(lines[0].text) : [];
  const body = first.length > 0 && !/^\d+$/.test(first[0]) && !position(first[3]) ? lines.slice(1) : lines;

  return body.map(({ text: t, line }): ImportRow => {
    const [numberCell = "", name = "", shortName = "", mainCell, secondaryCell = ""] = cells(t);
    const number = Number(numberCell);
    const main = position(mainCell);
    const secondaryCells = secondaryCell.split("/").filter((c) => c.trim());
    const unknown = secondaryCells.find((c) => !position(c));

    if (!/^\d+$/.test(numberCell) || number > 99) return { line, text: t, error: "Number must be 0–99" };
    if (!name) return { line, text: t, error: "Name is missing" };
    if (!main) return { line, text: t, error: `Unknown main position “${mainCell ?? ""}”` };
    if (unknown) return { line, text: t, error: `Unknown secondary position “${unknown.trim()}”` };
    if (taken.has(number)) return { line, text: t, error: `#${number} is already taken` };

    taken.add(number);

    const secondary = secondaryOf(
      secondaryCells.flatMap((c) => position(c) ?? []),
      main
    );

    return { line, text: t, draft: { number, name, shortName, main, secondary } };
  });
}
