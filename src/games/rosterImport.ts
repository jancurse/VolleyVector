import type { PlayerDraft } from "./useRoster";
import type { Position, RosterPlayer } from "./types";

// Parse pasted or uploaded roster text: one player per line, columns number, name, main position, and an
// optional secondary position, split by tab (a spreadsheet paste), comma, or semicolon. A first line whose
// number column is not a number is taken as a header and skipped. Positions read by name or code, in any
// case. Every line comes back either as a player to add or with the reason it cannot be.

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

export function parseRoster(text: string, roster: readonly RosterPlayer[]): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((t, i) => ({ text: t, line: i + 1 }))
    .filter(({ text: t }) => t.trim() !== "");
  const delimiter = /\t/.test(text) ? "\t" : /;/.test(text) && !/,/.test(text) ? ";" : ",";
  const taken = new Set(roster.filter((p) => !p.archived).map((p) => p.number));
  const cells = (t: string) => t.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const body = lines.length > 0 && !/^\d+$/.test(cells(lines[0].text)[0] ?? "") ? lines.slice(1) : lines;

  return body.map(({ text: t, line }): ImportRow => {
    const [numberCell = "", name = "", mainCell, secondaryCell] = cells(t);
    const number = Number(numberCell);
    const main = position(mainCell);
    const secondary = position(secondaryCell);

    if (!/^\d+$/.test(numberCell) || number > 99) return { line, text: t, error: "Number must be 0–99" };
    if (!name) return { line, text: t, error: "Name is missing" };
    if (!main) return { line, text: t, error: `Unknown main position “${mainCell ?? ""}”` };
    if (secondary === undefined) return { line, text: t, error: `Unknown secondary position “${secondaryCell}”` };
    if (taken.has(number)) return { line, text: t, error: `#${number} is already taken` };

    taken.add(number);

    return { line, text: t, draft: { number, name, main, secondary: secondary === main ? null : secondary } };
  });
}
