import type { JSX } from "react";

import { presetAssignment, presetOrder, rotationAssignment, rotationLabel, rotationPlayers } from "../boards/rotation";
import type { RotationViolation } from "../boards/rotation";
import type { Board, RotationSlot, StepRotation } from "../boards/types";
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

// The editor's rotation section: the per-step rotation selector (off, the 5-1 presets, custom), the
// per-board enforcement setting, and the always-visible rotation board while rotation is on. The
// presets stay disabled until the roster is a 5-1; custom only needs six players.
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
  const anyRotation = draft.steps.some((s) => s.rotation);

  const items = [
    { value: "off", label: "Off" },
    ...([1, 2, 3, 4, 5, 6] as const).map((n) => ({
      value: String(n),
      label: String(n),
      ariaLabel: `Rotation ${n}`,
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

  const hint = !enough
    ? "Rotation needs six players on the board."
    : !presetsOk
      ? "Presets need a 5-1 roster: a setter, two outsides, an opposite, and two middles or a middle and a libero. Custom is available."
      : rotation && !active
        ? rotation.kind === "custom"
          ? "Place all six players on their official positions to activate the rotation."
          : "The roster no longer matches a 5-1 preset."
        : null;

  return (
    <section className={PANEL} aria-label="Rotation">
      <span className={PANEL_TITLE}>Rotation</span>

      <ToggleGroup
        ariaLabel="Rotation"
        items={items}
        value={!rotation ? "off" : rotation.kind === "preset" ? String(rotation.rotation) : "custom"}
        onValueChange={change}
      />

      {hint && <p className="m-0 text-sm text-text-dim">{hint}</p>}

      {anyRotation && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={FIELD_LABEL}>Enforcement</span>
          <ToggleGroup
            ariaLabel="Enforcement"
            items={ENFORCEMENT_ITEMS}
            value={draft.rotationStrict ? "strict" : "loose"}
            onValueChange={(value) => onChangeStrict(value === "strict")}
          />
        </div>
      )}

      {rotation && (
        <>
          {active && (
            <p className="m-0 text-base font-semibold">
              {rotationLabel(rotation)}
              {violationMessages(violations).map((message) => (
                <span key={message} className="text-warn">
                  {" — "}
                  {message}
                </span>
              ))}
            </p>
          )}
          <div className={cx("w-full self-center", rotation.kind === "custom" ? "max-w-[320px]" : "max-w-[260px]")}>
            <RotationBoard
              markers={draft.markers}
              rotation={rotation}
              onPlace={rotation.kind === "custom" ? onPlace : undefined}
            />
          </div>
        </>
      )}
    </section>
  );
}
