import type { JSX } from "react";
import ReactMarkdown from "react-markdown";

import { Court } from "../court/Court";
import type { Tactic } from "../tactics/types";

// The read-only presentation of a tactic: the same court (without any editing affordances) and the
// description rendered as markdown. This is what players and share-link visitors will see, and where
// a coach lands before choosing to edit. Stage 3's drill playback will live here too.
type TacticViewProps = {
  tactic: Tactic;
  onEdit: () => void;
  onBack: () => void;
};

export function TacticView({ tactic, onEdit, onBack }: TacticViewProps): JSX.Element {
  return (
    <div className="vc-view">
      <button type="button" className="vc-back" onClick={onBack}>
        ← Library
      </button>
      <div className="vc-view-bar">
        <div className="vc-caption">
          <p className="vc-eyebrow">Tactic</p>
          <h1 className="vc-view-title">{tactic.title || "Untitled tactic"}</h1>
        </div>
        <button type="button" className="vc-primary" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="vc-view-body">
        <figure className="vc-court-frame">
          <Court markers={tactic.markers} label={tactic.title || "Untitled tactic"} />
        </figure>

        <section className="vc-desc vc-view-desc" aria-label="Description">
          <div className="vc-desc-head">
            <span className="vc-panel-title">Description</span>
          </div>
          {tactic.description.trim() ? (
            <div className="vc-markdown">
              <ReactMarkdown>{tactic.description}</ReactMarkdown>
            </div>
          ) : (
            <p className="vc-muted">No description yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
