import type { JSX } from "react";

import { ROLES } from "../court/roles";
import { cx, TAG_CHIP } from "../ui/styles";
import type { Position } from "./types";

// A playing position as a chip: the role's court colour as a dot, then its code (S, OH, MB, OPP, L). A
// secondary position reads quieter than the main one.
export function PositionChip({
  position,
  secondary = false,
}: {
  position: Position;
  secondary?: boolean;
}): JSX.Element {
  return (
    <span className={cx(TAG_CHIP, "font-mono", secondary && "text-text-dim")} title={ROLES[position].name}>
      <span className="size-2 rounded-full" style={{ background: ROLES[position].fill }} aria-hidden="true" />
      {ROLES[position].code}
    </span>
  );
}
