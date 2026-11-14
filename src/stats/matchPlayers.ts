import type { Position, RosterPlayer } from "../games/types";
import type { PlayerDraft } from "../games/useRoster";
import { sameName, setPlayerNames } from "./gameSets";
import type { AppData } from "./types";

// Linking the names in recorded sets to the roster. A name that matches a roster player (ignoring case) is that
// player, spelled as on the roster. Any other name is the coach's choice: a new roster player, or the same person
// as one already on it. Two names never become one player within a set, since that would merge their stats.

export type PlayerChoice = { kind: "add"; number: string; main: Position } | { kind: "same"; playerId: string };

/** The names the sets give with no roster player, in order of appearance. */
export function unmatchedNames(names: Iterable<string>, roster: readonly RosterPlayer[]): string[] {
  return [...new Set(names)].filter((n) => n.trim() && !roster.some((p) => sameName(p.name, n)));
}

/** A choice for each name: a new roster player each, numbered from the lowest free numbers. */
export function defaultChoices(
  names: readonly string[],
  roster: readonly RosterPlayer[]
): Record<string, PlayerChoice> {
  const free = Array.from({ length: 100 }, (_, n) => n).filter((n) => !roster.some((p) => p.number === n));

  return Object.fromEntries(
    names.map((n, i) => [n, { kind: "add", number: String(free[i] ?? ""), main: "outside" } satisfies PlayerChoice])
  );
}

/** The roster players `name` may be the same person as: active, and never in one set together with it. */
export function matchable(name: string, sets: readonly AppData[], roster: readonly RosterPlayer[]): RosterPlayer[] {
  const together = sets.filter((s) => setPlayerNames(s).has(name)).flatMap((s) => [...setPlayerNames(s)]);

  return roster.filter((p) => !p.archived && !together.some((n) => sameName(n, p.name)));
}

const parseNumber = (value: string): number | null => {
  const n = Number(value);

  return value.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};

/** What stops the choices from being applied, as one message per problem. */
export function choiceProblems(
  choices: Readonly<Record<string, PlayerChoice>>,
  sets: readonly AppData[],
  roster: readonly RosterPlayer[]
): string[] {
  const problems: string[] = [];
  const entries = Object.entries(choices);
  const numbers = entries.flatMap(([name, c]) => (c.kind === "add" ? [[name, parseNumber(c.number)] as const] : []));

  for (const [name, n] of numbers) {
    if (n === null) problems.push(`${name} needs a number from 0 to 99.`);
    else if (roster.some((p) => !p.archived && p.number === n) || numbers.some(([o, m]) => o !== name && m === n))
      problems.push(`Number ${n} is taken, so ${name} needs another.`);
  }

  for (const set of sets) {
    const names = setPlayerNames(set);
    const picked = entries.flatMap(([name, c]) => (c.kind === "same" && names.has(name) ? [[name, c.playerId]] : []));

    for (const [name, id] of picked) {
      const player = roster.find((p) => p.id === id);

      if (
        picked.some(([other, otherId]) => other < name && otherId === id) ||
        (player && [...names].some((n) => sameName(n, player.name)))
      )
        problems.push(`Set ${set.meta.setNumber || "?"} would have ${player?.name ?? "one player"} twice.`);
    }
  }

  return [...new Set(problems)];
}

/** The roster drafts for the names to add. */
export function newPlayers(choices: Readonly<Record<string, PlayerChoice>>): PlayerDraft[] {
  return Object.entries(choices).flatMap(([name, c]) =>
    c.kind === "add"
      ? [{ number: parseNumber(c.number) ?? 0, name: name.trim(), shortName: "", main: c.main, secondary: [] }]
      : []
  );
}

/** The renames the choices make: each name to its roster player's name. */
export function choiceRenames(
  choices: Readonly<Record<string, PlayerChoice>>,
  roster: readonly RosterPlayer[]
): Map<string, string> {
  return new Map(
    Object.entries(choices).flatMap(([name, c]) => {
      const to = c.kind === "same" ? roster.find((p) => p.id === c.playerId)?.name : name.trim();

      return to && to !== name ? [[name, to] as const] : [];
    })
  );
}
