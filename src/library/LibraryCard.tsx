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

const CARD =
  "flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-panel text-left text-text transition-[transform,border-color,box-shadow] duration-[180ms] ease-settle hover:-translate-y-[3px] hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--border))] hover:shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent animate-[rise_0.5s_var(--ease-settle)_both] motion-reduce:animate-none";

export function LibraryCard({ item, onOpen }: LibraryCardProps): JSX.Element {
  return (
    <button type="button" className={CARD} onClick={onOpen}>
      <div
        className="aspect-square w-full border-b border-border bg-court-surface transition-[background-color] duration-[400ms]"
        aria-hidden="true"
      >
        <Court markers={item.markers} opponentSide={item.opponentSide} label={item.title} compact />
      </div>
      <div className="flex flex-col gap-[0.35rem] px-[0.95rem] pt-[0.8rem] pb-4">
        <p className="m-0 font-mono text-2xs font-medium uppercase tracking-[0.28em] text-text-dim">
          {item.kind === "sequence" ? "Sequence" : "Position"}
        </p>
        <h3 className="m-0 font-display text-display-sm font-bold tracking-[-0.015em]">{item.title}</h3>
        <div className="mt-[0.1rem] flex flex-wrap items-center gap-[0.4rem]">
          <span className="font-mono text-2xs text-text-dim">{item.meta}</span>
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-pill border border-border bg-control px-[0.46rem] py-[0.12rem] text-2xs font-semibold text-text-dim"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
