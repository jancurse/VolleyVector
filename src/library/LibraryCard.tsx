import type { JSX } from "react";

import { Court } from "../court/Court";
import type { LibraryItem } from "./items";

// One library card: a static court thumbnail above the title, kind, count, and tags. The whole card
// is the click target that opens the board. The thumbnail is hidden from assistive tech because the
// title beside it already names the board.
type LibraryCardProps = {
  item: LibraryItem;
  onOpen: () => void;
};

export function LibraryCard({ item, onOpen }: LibraryCardProps): JSX.Element {
  return (
    <button type="button" className="vc-card" onClick={onOpen}>
      <div className="vc-card-court" aria-hidden="true">
        <Court markers={item.markers} label={item.title} />
      </div>
      <div className="vc-card-body">
        <p className="vc-eyebrow">{item.kind === "sequence" ? "Sequence" : "Position"}</p>
        <h3 className="vc-card-title">{item.title}</h3>
        <div className="vc-card-foot">
          <span className="vc-card-meta">{item.meta}</span>
          {item.tags.map((tag) => (
            <span key={tag} className="vc-tag vc-tag--sm">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
