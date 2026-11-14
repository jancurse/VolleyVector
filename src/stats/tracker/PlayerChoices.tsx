import type { JSX } from "react";

import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../../ui/Collapsible";
import { CALLOUT_WARN } from "../../ui/styles";
import type { Draft } from "../draft";
import type { Court } from "../types";
import { Choice } from "./Choice";
import { COURT_ROWS, playerKey } from "./courtRows";

type PlayerChoicesProps = {
  draft: Draft | null;
  players: readonly string[];
  /** Who is on court at the stat's moment: players are laid out by position when known. */
  court: Court | null;
  /** Whether a bare number key picks a player right now (otherwise it takes Shift). */
  keysLive: boolean;
  onPick: (player: string) => void;
};

/** The player step: the roster in key order, or the six on court by position with the bench folded away. */
export function PlayerChoices({ draft, players, court, keysLive, onPick }: PlayerChoicesProps): JSX.Element {
  if (players.length === 0) return <p className={CALLOUT_WARN}>No players yet. Add them under Players below.</p>;

  // Keys follow roster order, so each player keeps the same key all set.
  const choice = (p: string) => {
    const key = playerKey(players.indexOf(p));

    return (
      <Choice
        key={p}
        selected={draft?.player === p}
        suggested={draft?.suggested.player}
        hotkey={key && (keysLive ? key : `⇧${key}`)}
        hotkeyDim={!keysLive}
        onClick={() => onPick(p)}
      >
        {p}
      </Choice>
    );
  };

  if (!court) return <div className="grid grid-cols-4 gap-1.5">{players.map(choice)}</div>;

  const onCourt = new Set([...court.positions, court.libero]);
  const bench = players.filter((p) => !onCourt.has(p));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1.5">
        {COURT_ROWS.map((row, r) => (
          <div key={r} className="contents">
            {row.map((pos) => choice(court.positions[pos - 1]))}
            {/* The libero plays the back row, so sits beside it. */}
            {r === 1 && court.libero ? (
              <div title="Libero" className="rounded-md ring-1 ring-border">
                {choice(court.libero)}
              </div>
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>
      {bench.length > 0 && (
        <Collapsible defaultOpen={false}>
          <div className="flex items-center gap-1 text-xs text-text-dim">
            <CollapsibleCaret label="Bench" />
            Bench ({bench.length})
          </div>
          <CollapsiblePanel className="mt-1.5 grid grid-cols-4 gap-1.5">{bench.map(choice)}</CollapsiblePanel>
        </Collapsible>
      )}
    </div>
  );
}
