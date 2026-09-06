import type { JSX } from "react";

import { arrowsForStep } from "../boards/arrows";
import { stepAnnotations, stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { isSequence } from "../boards/types";
import { Court } from "../court/Court";
import { Markdown } from "../ui/Markdown";
import { cx, EYEBROW } from "../ui/styles";

// One board as a printable document section: its kind and title, the description, then each step as a
// static court. A Position prints its single diagram; a Sequence prints a card per step, each carrying
// the derived arrows previewing its upcoming move and its instruction, kept whole across page breaks.

const COURT = "m-0 w-full rounded-xl border border-border bg-court-surface";

export function BoardPrint({ board }: { board: Board }): JSX.Element {
  const sequence = isSequence(board);
  const court = cx(COURT, board.opponentSide ? "aspect-[13/23]" : "aspect-square");

  return (
    <section className="flex flex-col gap-5">
      <header className="break-inside-avoid break-after-avoid border-b border-border pb-3">
        <p className={EYEBROW}>{sequence ? `Sequence · ${board.steps.length} steps` : "Position"}</p>
        <h2 className="m-0 font-display text-[1.6rem] font-bold leading-[1.1] tracking-[-0.02em]">
          {board.title || "Untitled board"}
        </h2>
      </header>

      {board.description.trim() && <Markdown>{board.description}</Markdown>}

      {sequence ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-7">
          {board.steps.map((step, i) => (
            <figure key={step.id} className="m-0 flex break-inside-avoid flex-col gap-2">
              <div className={court}>
                <Court
                  markers={stepMarkers(board, i)}
                  opponentSide={board.opponentSide}
                  arrows={board.autoArrows ? arrowsForStep(board, i) : []}
                  annotations={stepAnnotations(board, i)}
                  label={`${board.title || "Untitled board"} — step ${i + 1}`}
                />
              </div>
              <figcaption className="flex flex-col gap-1">
                <span className="font-mono text-2xs font-medium uppercase tracking-[0.22em] text-text-dim">
                  Step {i + 1}
                </span>
                {step.instruction.trim() && <Markdown className="text-sm">{step.instruction}</Markdown>}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className={cx(court, "max-w-[430px] break-inside-avoid")}>
          <Court
            markers={stepMarkers(board, 0)}
            opponentSide={board.opponentSide}
            annotations={stepAnnotations(board, 0)}
            label={board.title || "Untitled board"}
          />
        </div>
      )}
    </section>
  );
}
