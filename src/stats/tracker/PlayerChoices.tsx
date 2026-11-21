import type { JSX } from "react";

import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../../ui/Collapsible";
import { CALLOUT_WARN, cx } from "../../ui/styles";
import type { Draft } from "../draft";
import type { Court } from "../types";
import { Choice } from "./Choice";
import { COURT_ROWS, playerKey } from "./courtRows";

/** Three across, as a court row is, for the roster and the bench too so neither widens the step. */
const GRID = "grid grid-cols-3 gap-1.5";

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
  if (players.length === 0) return <p className={CALLOUT_WARN}>No players yet. Add them with Change.</p>;

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

  if (!court) return <div className={GRID}>{players.map(choice)}</div>;

  const onCourt = new Set([...court.positions, court.libero]);
  const bench = players.filter((p) => !onCourt.has(p));

  return (
    <div className="flex flex-col gap-1.5">
      <div className={GRID}>
        {COURT_ROWS.flat().map((pos) => choice(court.positions[pos - 1]))}
        {/* The libero plays the back row, so sits under it. */}
        {court.libero && (
          <div title="Libero" className="col-start-2 rounded-md ring-1 ring-border">
            {choice(court.libero)}
          </div>
        )}
      </div>
      {bench.length > 0 && (
        <Collapsible defaultOpen={false}>
          <div className="flex items-center gap-1 text-xs text-text-dim">
            <CollapsibleCaret label="Bench" />
            Bench ({bench.length})
          </div>
          <CollapsiblePanel className={cx("mt-1.5", GRID)}>{bench.map(choice)}</CollapsiblePanel>
        </Collapsible>
      )}
    </div>
  );
}
