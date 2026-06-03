import type { JSX } from "react";

import type { Tactic } from "../tactics/types";

// The tactics rail: the minimal browse-and-pick surface for Stage 2. Stage 4 grows this into the
// full library with tags and filtering; here it only lists, selects, and starts a new tactic.
type TacticListProps = {
  tactics: readonly Tactic[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function TacticList({ tactics, currentId, onSelect, onCreate }: TacticListProps): JSX.Element {
  return (
    <nav className="vc-library" aria-label="Tactics">
      <div className="vc-library-head">
        <span className="vc-panel-title">Tactics</span>
        <button type="button" className="vc-new" onClick={onCreate}>
          + New
        </button>
      </div>

      <ul className="vc-tactic-list">
        {tactics.map((tactic) => (
          <li key={tactic.id}>
            <button
              type="button"
              className={`vc-tactic-item${tactic.id === currentId ? " vc-tactic-item--on" : ""}`}
              aria-current={tactic.id === currentId}
              onClick={() => onSelect(tactic.id)}
            >
              <span className="vc-tactic-title">{tactic.title || "Untitled tactic"}</span>
              <span className="vc-tactic-meta">
                {tactic.markers.length} {tactic.markers.length === 1 ? "marker" : "markers"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
