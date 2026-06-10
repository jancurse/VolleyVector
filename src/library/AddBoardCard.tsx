import type { JSX } from "react";
import { Plus } from "lucide-react";

// The dashed "add" tile rendered as a grid cell: the create action sits where its result will appear.
// Quiet at rest, it picks up the cards' accent border on hover.
type AddBoardCardProps = {
  onNew: () => void;
};

const TILE =
  "flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-text-dim transition-[border-color,color,background-color] duration-[180ms] ease-settle hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--border))] hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function AddBoardCard({ onNew }: AddBoardCardProps): JSX.Element {
  return (
    <button type="button" className={TILE} onClick={onNew}>
      <Plus size={22} aria-hidden="true" />
      <span className="font-ui text-sm font-medium">New board</span>
    </button>
  );
}
