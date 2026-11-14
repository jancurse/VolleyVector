import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../../ui/Button";
import { MUTED, NET_CAPTION, NET_LINE, PANEL, PANEL_TITLE } from "../../ui/styles";
import type { Court, Team } from "../types";
import { COURT_ROWS } from "./courtRows";
import { CourtSpot } from "./CourtSpot";
import { LineupEditor } from "./LineupEditor";

type LineupPanelProps = {
  court: Court | null;
  serving: Team | null;
  players: readonly string[];
  lineup: readonly string[];
  libero: string;
  onSetLineup: (lineup: string[], libero: string) => void;
  onSub: (out: string, inn: string) => void;
};

/** Who is on court now, by position; picking a player offers the bench to substitute them. */
export function LineupPanel({
  court,
  serving,
  players,
  lineup,
  libero,
  onSetLineup,
  onSub,
}: LineupPanelProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [subFor, setSubFor] = useState<string | null>(null);

  if (editing || !court) {
    return (
      <LineupEditor
        players={players}
        lineup={lineup}
        libero={libero}
        open={editing}
        onOpen={() => setEditing(true)}
        onCancel={() => setEditing(false)}
        onSave={(l, lib) => {
          onSetLineup(l, lib);
          setEditing(false);
        }}
      />
    );
  }

  const onCourt = new Set([...court.positions, court.libero]);
  const bench = players.filter((p) => !onCourt.has(p));
  const toggle = (name: string) => setSubFor(subFor === name ? null : name);

  return (
    <section className={PANEL} aria-labelledby="court-title">
      <div className="flex items-center justify-between">
        <h2 id="court-title" className={PANEL_TITLE}>
          On court
        </h2>
        <Button variant="text" onClick={() => setEditing(true)}>
          Edit starting lineup
        </Button>
      </div>
      <div>
        <div className={NET_CAPTION}>net</div>
        <div className={`${NET_LINE} flex flex-col gap-1.5`}>
          {COURT_ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-3 gap-1.5">
              {row.map((pos) => {
                const name = court.positions[pos - 1];

                return (
                  <CourtSpot
                    key={pos}
                    pos={String(pos)}
                    name={name}
                    serving={pos === 1 && serving === "us"}
                    active={subFor === name}
                    onClick={() => toggle(name)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {court.libero && (
        <CourtSpot pos="L" name={court.libero} active={subFor === court.libero} onClick={() => toggle(court.libero)} />
      )}
      {subFor ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-control p-2">
          <p className="m-0 text-xs text-text">
            Substitute for <b>{subFor}</b>:
          </p>
          {bench.length ? (
            <div className="flex flex-wrap gap-1.5">
              {bench.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSub(subFor, p);
                    setSubFor(null);
                  }}
                >
                  {p}
                </Button>
              ))}
            </div>
          ) : (
            <p className={MUTED}>Everyone on the roster is already on court.</p>
          )}
        </div>
      ) : (
        <p className="m-0 text-xs text-text-dim">Click a player to substitute. The server is in position 1.</p>
      )}
    </section>
  );
}
