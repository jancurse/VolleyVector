import type { JSX } from "react";

import { presetAssignment, presetOrder, rotationAssignment, rotationPlayers } from "../boards/rotation";
import type { RotationViolation } from "../boards/rotation";
import type { Board, RotationSlot, StepRotation } from "../boards/types";
import { Select } from "../ui/Select";
import { ToggleGroup } from "../ui/ToggleGroup";
import { FIELD_LABEL, PANEL, PANEL_TITLE, cx } from "../ui/styles";
import { RotationBoard } from "./RotationBoard";

const ENFORCEMENT_ITEMS = [
  { value: "loose", label: "Loose" },
  { value: "strict", label: "Strict" },
];

/** The distinct fault messages a set of violations reads as, for the rotation label. */
export function violationMessages(violations: readonly RotationViolation[]): string[] {
  const messages: string[] = [];

  if (violations.some((v) => v.kind !== "libero")) messages.push("positional fault");
  if (violations.some((v) => v.kind === "libero")) messages.push("illegal libero position");

  return messages;
}

// The editor's rotation card: a quiet per-step selector (off, the 5-1 presets, custom) in the header,
// with the body — the rotation board beside the faults and the per-board enforcement setting —
// appearing only with a rotation on, so the card stays one slim row while off. The presets stay
// disabled until the roster is a 5-1; custom only needs six players; the selector's caption explains
// whichever applies.
type RotationPanelProps = {
  draft: Board;
  stepIndex: number;
  violations: readonly RotationViolation[];
  onChangeRotation: (rotation: StepRotation | undefined) => void;
  onPlace: (markerId: string, slot: RotationSlot | null) => void;
  onChangeStrict: (strict: boolean) => void;
};

export function RotationPanel({
  draft,
  stepIndex,
  violations,
  onChangeRotation,
  onPlace,
  onChangeStrict,
}: RotationPanelProps): JSX.Element {
  const rotation = draft.steps[stepIndex]?.rotation;
  const enough = rotationPlayers(draft.markers).length >= 6;
  const presetsOk = presetOrder(draft.markers) !== null;
  const active = rotationAssignment(draft.markers, rotation) !== null;

  const options = [
    { value: "off", label: "Off" },
    ...([1, 2, 3, 4, 5, 6] as const).map((n) => ({
      value: String(n),
      label: `Rotation ${n}`,
      disabled: !enough || !presetsOk,
    })),
    { value: "custom", label: "Custom", disabled: !enough },
  ];

  // Switching to Custom seeds from the assignment currently shown, so it edits rather than starts
  // over; only a step with no prior assignment starts from scratch.
  const change = (value: string) => {
    if (value === "off") return onChangeRotation(undefined);
    if (value !== "custom") return onChangeRotation({ kind: "preset", rotation: Number(value) as RotationSlot });
    if (rotation?.kind === "custom") return;

    const seed = rotation ? (presetAssignment(draft.markers, rotation.rotation) ?? {}) : {};

    onChangeRotation({ kind: "custom", assignment: seed });
  };

  const hint =
    rotation && !active
      ? rotation.kind === "custom"
        ? "Place all six players on their official positions to activate the rotation."
        : "The roster no longer matches a 5-1 preset."
      : null;

  return (
    <section className={PANEL} aria-label="Rotation">
      <div className="flex items-center justify-between gap-3">
        <span className={PANEL_TITLE}>Rotation</span>
        <Select
          variant="quiet"
          ariaLabel="Rotation"
          options={options}
          value={!rotation ? "off" : rotation.kind === "preset" ? String(rotation.rotation) : "custom"}
          onValueChange={change}
          caption={
            !enough
              ? "Rotation needs six players on the board."
              : !presetsOk
                ? "Presets need a 5-1 roster: a setter, two outsides, an opposite, and two middles or a middle and a libero. Custom is available."
                : undefined
          }
        />
      </div>

      {hint && <p className="m-0 text-sm text-text-dim">{hint}</p>}

      {rotation && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className={cx("w-full", rotation.kind === "custom" ? "max-w-[300px]" : "max-w-[240px]")}>
            <RotationBoard
              markers={draft.markers}
              rotation={rotation}
              onPlace={rotation.kind === "custom" ? onPlace : undefined}
            />
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-3">
            {violationMessages(violations).map((message) => (
              <p key={message} className="m-0 text-sm font-semibold text-warn">
                {message}
              </p>
            ))}
            <div className="flex flex-col items-start gap-1.5">
              <span className={FIELD_LABEL}>Enforcement</span>
              <ToggleGroup
                ariaLabel="Enforcement"
                items={ENFORCEMENT_ITEMS}
                value={draft.rotationStrict ? "strict" : "loose"}
                onValueChange={(value) => onChangeStrict(value === "strict")}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
