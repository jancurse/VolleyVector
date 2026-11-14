import { resultDef, touchReasonsFor } from "./codes";
import type { Skill, Touch } from "./types";

/** A stat being entered (or edited) in the entry panel. */
export type Draft = {
  editingId: number | null;
  timestamp: number;
  player: string;
  stat: Skill | "";
  result: string;
  zone: string;
  /** Optional detail (see TOUCH_REASONS); never required to save. */
  reason: string;
  /** Fields pre-filled by prediction rather than chosen by the user. */
  suggested: { player: boolean; stat: boolean };
};

export type Field = "player" | "stat" | "result" | "zone";
export const FIELDS: Field[] = ["player", "stat", "result", "zone"];

export const newDraft = (timestamp: number, player = "", stat: Skill | "" = ""): Draft => ({
  editingId: null,
  timestamp,
  player,
  stat,
  result: "",
  zone: "",
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
  reason: t.reason ?? "",
  suggested: { player: false, stat: false },
});

/** The first field still waiting for input; keyboard digits go here. */
export const currentStep = (d: Draft): Field | null => FIELDS.find((f) => d[f] === "") ?? null;

export const isComplete = (d: Draft): boolean => currentStep(d) === null;

export function setField(d: Draft, field: Field, value: string): Draft {
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
  ...(d.reason && { reason: d.reason }),
});
