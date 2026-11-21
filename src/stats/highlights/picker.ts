import { SKILLS } from "../codes";
import type { SkillDef } from "../codes";
import type { HighlightAction, Selection } from "../clips";
import { OPPONENT, setKey } from "../clips";

/** What every picker of the highlights' filter bar works from. */
export type PickerProps = {
  actions: readonly HighlightAction[];
  selection: Selection;
  onChange: (patch: Partial<Selection>) => void;
};

/** `values` with `value` added, or removed when it was there. */
export function toggled(values: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(values);

  if (!next.delete(value)) next.add(value);

  return next;
}

type Game = { match: string; sets: string[] };

/** The matches in the order they were played, each with its sets. */
export function games(actions: readonly HighlightAction[]): Game[] {
  const dates = new Map(actions.map((a) => [a.match, a.date]));
  const sets = new Map<string, Set<string>>();

  for (const a of actions) sets.set(a.match, (sets.get(a.match) ?? new Set()).add(a.set));

  return [...sets]
    .sort(([a], [b]) => (dates.get(a) ?? "").localeCompare(dates.get(b) ?? "") || a.localeCompare(b))
    .map(([match, names]) => ({
      match,
      sets: [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }));
}

export const shortSet = (set: string): string => set.replace("Set ", "S");

/** The picked sets as the bar names them: a whole match by its name, otherwise its sets. */
export function pickedGames(actions: readonly HighlightAction[], picked: ReadonlySet<string>): string[] {
  const all = games(actions);

  return all.flatMap(({ match, sets }) => {
    const mine = sets.filter((s) => picked.has(setKey(match, s)));

    if (mine.length === sets.length && all.length > 1) return [match];

    return mine.map((s) => (all.length > 1 ? `${match} ${shortSet(s)}` : s));
  });
}

/** An action as the filters name it: an opponent's untouched point is not one of our actions. */
export const actionName = (action: string): string => (action === "Point" ? "Opponent point" : action);

/** The skill an action label belongs to ("Attack, tip" is an attack), when it is one of ours. */
export const actionSkill = (action: string): SkillDef | undefined =>
  SKILLS.find((s) => s.label === action.split(",")[0]);

/** The actions in the order the tracker lists their skills, a skill's kinds after it. */
export function actionNames(actions: readonly HighlightAction[]): string[] {
  const rank = (action: string) => {
    const index = SKILLS.findIndex((s) => s === actionSkill(action));

    return index < 0 ? SKILLS.length : index;
  };

  return [...new Set(actions.map((a) => a.action))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** The picked actions as the bar names them, each with the outcomes it is narrowed to. */
export const pickedActions = (selection: Selection): string[] =>
  [...selection.action].map((action) => {
    const outcomes = [...selection.outcome]
      .filter((key) => key.startsWith(`${action}|`))
      .map((key) => key.slice(action.length + 1));

    return outcomes.length ? `${actionName(action)}: ${outcomes.join(", ")}` : actionName(action);
  });

export const zoneName = (zone: string): string => (zone === "0" ? "No zone" : `Z${zone}`);

/** The players by name, the opponent last. */
export const playerNames = (actions: readonly HighlightAction[]): string[] =>
  [...new Set(actions.map((a) => a.player))]
    .filter(Boolean)
    .sort((a, b) => Number(a === OPPONENT) - Number(b === OPPONENT) || a.localeCompare(b));
