import { useState } from "react";
import type { JSX } from "react";
import { Pencil, X } from "lucide-react";

import { PositionChip } from "../games/PositionChip";
import type { RosterPlayer } from "../games/types";
import { useRoster } from "../games/useRoster";
import type { PlayerDraft } from "../games/useRoster";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Table, TableCell, TableHeadCell } from "../ui/Table";
import { MUTED, PANEL_TITLE } from "../ui/styles";
import { useConfirm } from "../ui/useConfirm";
import { PlayerDialog } from "./PlayerDialog";

// The team's player roster: jersey number, name, and positions, the list a game's squad is picked from. A
// coach or admin (canManage) adds, edits, and removes players; anyone else reads it. Removing archives the
// player, so the games that include them keep their number and name.
type RosterSectionProps = {
  teamId: string;
  teamName: string;
  canManage: boolean;
};

type Editing = { kind: "add" } | { kind: "edit"; player: RosterPlayer } | null;

const BLANK: PlayerDraft = { number: Number.NaN, name: "", main: "outside", secondary: null };

export function RosterSection({ teamId, teamName, canManage }: RosterSectionProps): JSX.Element {
  const { players, loading, error, addPlayer, updatePlayer, archivePlayer } = useRoster(teamId);
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<Editing>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const active = players.filter((p) => !p.archived);

  const remove = async (player: RosterPlayer) => {
    const ok = await confirm({
      title: `Remove #${player.number} ${player.name}?`,
      description: `They leave the ${teamName} roster. Games that already include them keep them.`,
      confirmLabel: "Remove",
      danger: true,
    });

    if (!ok) return;

    setRemoveError((await archivePlayer(player.id)).error);
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="roster-title">
      <div className="flex max-w-2xl items-center justify-between gap-3">
        <h2 id="roster-title" className={PANEL_TITLE}>
          Roster
        </h2>
        {canManage && (
          <Button variant="ghost" onClick={() => setEditing({ kind: "add" })}>
            Add player
          </Button>
        )}
      </div>

      {loading ? (
        <p className={MUTED}>Loading…</p>
      ) : error ? (
        <p className="m-0 text-sm text-danger">{error}</p>
      ) : active.length === 0 ? (
        <p className={MUTED}>
          {canManage ? "Add your players to pick them for games." : "No players on the roster yet."}
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <TableHeadCell className="w-16">No.</TableHeadCell>
              <TableHeadCell>Player</TableHeadCell>
              <TableHeadCell>Positions</TableHeadCell>
              {canManage && <TableHeadCell className="w-20" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {active.map((player) => (
              <tr key={player.id}>
                <TableCell className="font-display text-xl font-bold tabular-nums">{player.number}</TableCell>
                <TableCell className="max-w-xs truncate font-medium">{player.name}</TableCell>
                <TableCell>
                  <span className="flex gap-1.5">
                    <PositionChip position={player.main} />
                    {player.secondary && <PositionChip position={player.secondary} secondary />}
                  </span>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <IconButton
                        variant="plain"
                        size="sm"
                        aria-label={`Edit #${player.number}`}
                        onClick={() => setEditing({ kind: "edit", player })}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        variant="plain"
                        size="sm"
                        aria-label={`Remove #${player.number}`}
                        onClick={() => void remove(player)}
                      >
                        <X size={14} aria-hidden="true" />
                      </IconButton>
                    </span>
                  </TableCell>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {removeError && <p className="m-0 text-sm text-danger">{removeError}</p>}

      {editing && (
        <PlayerDialog
          title={editing.kind === "add" ? "Add player" : `Edit #${editing.player.number}`}
          initial={editing.kind === "add" ? BLANK : editing.player}
          onSave={(draft) => (editing.kind === "add" ? addPlayer(draft) : updatePlayer(editing.player.id, draft))}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog}
    </section>
  );
}
