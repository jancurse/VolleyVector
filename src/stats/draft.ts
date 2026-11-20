import { defaultType, resultDef, touchReasonsFor } from "./codes";
import type { Skill, Touch } from "./types";

/** A stat being entered (or edited) in the entry panel. */
export type Draft = {
  editingId: number | null;
  timestamp: number;
  player: string;
  stat: Skill | "";
  result: string;
  zone: string;
  /** The kind of attack or defense; never required to save. */
  type: string;
  /** Optional detail (see TOUCH_REASONS); never required to save. */
  reason: string;
  /** Fields pre-filled by prediction rather than chosen by the user. */
  suggested: { player: boolean; stat: boolean };
};

export type Field = "player" | "stat" | "result" | "zone";
export const FIELDS: Field[] = ["player", "stat", "result", "zone"];

export const newDraft = (timestamp: number, player = "", stat: Skill | "" = "", detailed = false): Draft => ({
  editingId: null,
  timestamp,
  player,
  stat,
  result: "",
  zone: "",
  type: defaultType(stat, detailed),
  reason: "",
  suggested: { player: !!player, stat: !!stat },
});

export const draftFromTouch = (t: Touch): Draft => ({
  editingId: t.id,
  timestamp: t.timestamp,
  player: t.player,
  stat: t.stat,
  result: t.result,
  zone: t.zone,
  type: t.type ?? "",
  reason: t.reason ?? "",
  suggested: { player: false, stat: false },
});

/** The first field still waiting for input; keyboard digits go here. */
export const currentStep = (d: Draft): Field | null => FIELDS.find((f) => d[f] === "") ?? null;

export const isComplete = (d: Draft): boolean => currentStep(d) === null;

/** Fill in one field. `detailed` is whether the set records detailed stats, which a new skill's type follows. */
export function setField(d: Draft, field: Field, value: string, detailed = false): Draft {
  switch (field) {
    case "player":
      return { ...d, player: value, suggested: { ...d.suggested, player: false } };
    case "stat": {
      const changed = value !== d.stat;

      return {
        ...d,
        stat: value as Skill,
        result: changed ? "" : d.result,
        zone: changed ? "" : d.zone,
        type: changed ? defaultType(value as Skill, detailed) : d.type,
        reason: changed ? "" : d.reason,
        suggested: { ...d.suggested, stat: false },
      };
    }
    case "result": {
      const auto = d.stat ? resultDef(d.stat, value)?.autoZone : undefined;
      const prevAuto = d.stat ? resultDef(d.stat, d.result)?.autoZone : undefined;
      const keepReason = touchReasonsFor(d.stat, value).some((r) => r.id === d.reason);

      return {
        ...d,
        result: value,
        zone: auto ?? (prevAuto !== undefined ? "" : d.zone),
        reason: keepReason ? d.reason : "",
      };
    }
    case "zone":
      return { ...d, zone: value };
  }
}

/** The kind of attack or defense the draft shows as picked. Without detailed stats an attack is a hit. */
export const draftType = (d: Draft, detailed = false): string =>
  d.stat === "freeball" ? "freeball" : d.type || (d.stat === "attack" && !detailed ? "hit" : "");

/** Pick a kind of attack or defense. A freeball is a skill of its own in the file, so it changes the skill. */
export function setType(d: Draft, type: string, detailed = false): Draft {
  if (type === "freeball") return setField(d, "stat", "freeball", detailed);

  return { ...(d.stat === "freeball" ? setField(d, "stat", "attack", detailed) : d), type: detailed ? type : "" };
}

/** Switch an optional reason on or off. */
export const toggleReason = (d: Draft, reason: string): Draft => ({
  ...d,
  reason: d.reason === reason ? "" : reason,
});

/** Undo the most recent choice (Backspace). */
export function clearLast(d: Draft): Draft {
  const step = currentStep(d);
  const idx = step ? FIELDS.indexOf(step) : FIELDS.length;
  const field = FIELDS[idx - 1];

  if (!field) return d;
  // Clearing the result also clears a zone that was filled in automatically.
  if (field === "zone" && d.stat && resultDef(d.stat, d.result)?.autoZone) {
    return { ...d, result: "", zone: "", reason: "" };
  }

  // A reason only makes sense for the result it was given with.
  return { ...d, [field]: "", ...(field === "result" || field === "stat" ? { reason: "" } : {}) };
}

export const draftToTouch = (d: Draft, id: number): Touch => ({
  kind: "touch",
  id,
  timestamp: d.timestamp,
  player: d.player,
  stat: d.stat as Skill,
  result: d.result,
  zone: d.zone,
  ...(d.type && { type: d.type }),
  ...(d.reason && { reason: d.reason }),
});
