import type { JSX } from "react";

import { POSITION_OPTIONS } from "../../games/format";
import type { Position, RosterPlayer } from "../../games/types";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { CALLOUT_WARN } from "../../ui/styles";
import { choiceProblems, matchable } from "../matchPlayers";
import type { PlayerChoice } from "../matchPlayers";
import type { AppData } from "../types";

type PlayerMatchesProps = {
  /** The names to choose for, each with a choice in `choices`. */
  names: readonly string[];
  choices: Readonly<Record<string, PlayerChoice>>;
  /** The sets the names come from, so no two players of one set become one. */
  sets: readonly AppData[];
  roster: readonly RosterPlayer[];
  onChange: (name: string, choice: PlayerChoice) => void;
};

/** The players recorded sets name who aren't on the roster: each one added to it, or matched to someone on it. */
export function PlayerMatches({ names, choices, sets, roster, onChange }: PlayerMatchesProps): JSX.Element {
  const problems = choiceProblems(choices, sets, roster);

  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {names.map((name) => {
          const choice = choices[name];

          return (
            <li key={name} className="flex flex-wrap items-center gap-2">
              <span className="w-32 truncate font-medium" title={name}>
                {name}
              </span>
              <span className="w-56">
                <Select
                  ariaLabel={`${name} on the roster`}
                  value={choice?.kind === "same" ? choice.playerId : ""}
                  onValueChange={(v) =>
                    onChange(name, v ? { kind: "same", playerId: v } : { kind: "add", number: "", main: "outside" })
                  }
                  options={[
                    { value: "", label: "Add to the roster" },
                    ...matchable(name, sets, roster).map((p) => ({
                      value: p.id,
                      label: `Same as #${p.number} ${p.name}`,
                    })),
                  ]}
                />
              </span>
              {choice?.kind === "add" && (
                <>
                  <span className="w-20">
                    <Input
                      aria-label={`${name}’s number`}
                      inputMode="numeric"
                      placeholder="No."
                      value={choice.number}
                      onChange={(e) => onChange(name, { ...choice, number: e.target.value })}
                    />
                  </span>
                  <span className="w-36">
                    <Select
                      ariaLabel={`${name}’s position`}
                      value={choice.main}
                      options={POSITION_OPTIONS}
                      onValueChange={(v) => onChange(name, { ...choice, main: v as Position })}
                    />
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {problems.length > 0 && <p className={CALLOUT_WARN}>{problems.join(" ")}</p>}
    </div>
  );
}
