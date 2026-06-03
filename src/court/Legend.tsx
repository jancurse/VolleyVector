import type { JSX } from "react";

import type { MarkerRole } from "./roles";
import { ROLES } from "./roles";

// Documents the role -> colour -> label mapping that the markers use, so the visual language is
// legible at a glance.
const ORDER: MarkerRole[] = ["setter", "outside", "middle", "opposite", "libero", "ball"];

export function Legend(): JSX.Element {
  return (
    <ul className="vc-legend">
      {ORDER.map((role) => {
        const style = ROLES[role];

        return (
          <li key={role} className="vc-legend-item">
            <span className="vc-swatch" style={{ background: style.fill, borderColor: style.ring, color: style.text }}>
              {style.code}
            </span>
            <span className="vc-legend-name">{style.name}</span>
          </li>
        );
      })}
    </ul>
  );
}
