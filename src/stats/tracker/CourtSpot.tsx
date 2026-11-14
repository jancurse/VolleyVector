import type { JSX } from "react";

import { COURT_SPOT, COURT_SPOT_TONE, cx } from "../../ui/styles";

/** One player on the lineup court; picking them opens the substitution choice. */
export function CourtSpot({
  pos,
  name,
  serving,
  active,
  onClick,
}: {
  pos: string;
  name: string;
  serving?: boolean;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(COURT_SPOT, COURT_SPOT_TONE[active ? "active" : pos === "L" ? "libero" : "idle"])}
      title={pos === "L" ? "Libero" : `Position ${pos}`}
    >
      <span className="absolute top-1/2 left-1.5 -translate-y-1/2 font-mono text-2xs opacity-60">{pos}</span>
      {name}
      {serving && (
        <span className="ml-1 text-xs" title="Serving">
          (serving)
        </span>
      )}
    </button>
  );
}
