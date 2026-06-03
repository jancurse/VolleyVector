import type { JSX } from "react";

import type { Drill } from "../drills/types";

// The drills rail, mirroring the tactics rail. Stage 4 folds both into the full library with tags and
// filtering; here it only lists, selects, and starts a new drill.
type DrillListProps = {
  drills: readonly Drill[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

export function DrillList({ drills, currentId, onSelect, onCreate }: DrillListProps): JSX.Element {
  return (
    <nav className="vc-library" aria-label="Drills">
      <div className="vc-library-head">
        <span className="vc-panel-title">Drills</span>
        <button type="button" className="vc-new" onClick={onCreate}>
          + New
        </button>
      </div>

      <ul className="vc-tactic-list">
        {drills.map((drill) => (
          <li key={drill.id}>
            <button
              type="button"
              className={`vc-tactic-item${drill.id === currentId ? " vc-tactic-item--on" : ""}`}
              aria-current={drill.id === currentId}
              onClick={() => onSelect(drill.id)}
            >
              <span className="vc-tactic-title">{drill.title || "Untitled drill"}</span>
              <span className="vc-tactic-meta">
                {drill.steps.length} {drill.steps.length === 1 ? "step" : "steps"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
