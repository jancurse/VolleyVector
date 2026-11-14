import { useState } from "react";
import type { JSX } from "react";

import { PlayerMatches } from "../stats/import/PlayerMatches";
import { choiceProblems, defaultChoices } from "../stats/matchPlayers";
import type { PlayerChoice } from "../stats/matchPlayers";
import type { AppData } from "../stats/types";
import { Button } from "../ui/Button";
import { CALLOUT_WARN, PANEL_TITLE } from "../ui/styles";
import type { RosterPlayer } from "./types";

type UnmatchedPlayersProps = {
  names: readonly string[];
  sets: readonly AppData[];
  roster: readonly RosterPlayer[];
  /** Apply the choices; resolves to a problem to show, or null. */
  onApply: (choices: Record<string, PlayerChoice>) => Promise<string | null>;
};

/** Players the game's sets name who aren't on the roster, to add to it or match to someone on it. */
export function UnmatchedPlayers({ names, sets, roster, onApply }: UnmatchedPlayersProps): JSX.Element {
  const [chosen, setChosen] = useState<Record<string, PlayerChoice>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const defaults = defaultChoices(names, roster);
  const choices = Object.fromEntries(names.map((n) => [n, chosen[n] ?? defaults[n]!]));

  const apply = async () => {
    setBusy(true);
    setProblem(await onApply(choices));
    setBusy(false);
  };

  return (
    <section className="flex flex-col gap-2 border-t border-border pt-3" aria-labelledby="unmatched-title">
      <h3 id="unmatched-title" className={PANEL_TITLE}>
        In the sets, not on the roster
      </h3>
      <p className="m-0 text-sm text-text-dim">
        Add each player to the roster, or pick who they are on it. Their sets then use the roster’s name.
      </p>
      <PlayerMatches
        names={names}
        choices={choices}
        sets={sets}
        roster={roster}
        onChange={(name, choice) => setChosen((c) => ({ ...c, [name]: choice }))}
      />
      {problem && <p className={CALLOUT_WARN}>{problem}</p>}
      <div className="flex">
        <Button
          variant="ghost"
          onClick={() => void apply()}
          disabled={busy || choiceProblems(choices, sets, roster).length > 0}
        >
          {busy ? "Saving…" : "Add to the squad"}
        </Button>
      </div>
    </section>
  );
}
