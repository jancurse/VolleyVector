import { X } from "lucide-react";
import type { JSX } from "react";

import type { Game } from "../../games/types";
import { VENUES } from "../../games/types";
import { IconButton } from "../../ui/IconButton";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { CALLOUT_NOTE, CALLOUT_WARN, PANEL } from "../../ui/styles";
import { formatGameDate, VENUE_LABEL, versus } from "../../games/format";
import { gameName, withSide } from "../importSets";
import type { ImportedSet, ImportGroup } from "../importSets";

/**
 * One group of imported sets: which of their teams is ours, the game they go into, and the sets in it. A new or
 * blank game takes its name, date, opponent, and venue from here; an existing game keeps its own.
 */
export function ImportGroupRow({
  group,
  teamName,
  games,
  fills,
  clashes,
  onChange,
  onRemove,
}: {
  group: ImportGroup;
  teamName: string;
  games: readonly Game[];
  /** True when the sets fill in their game's details (a new game, or a blank one). */
  fills: boolean;
  clashes: readonly number[];
  onChange: (change: Partial<ImportGroup>) => void;
  onRemove: (set: ImportedSet) => void;
}): JSX.Element {
  const target = games.find((g) => g.id === group.gameId);
  const sides = [group.home, group.away].every((n) => n.trim());

  return (
    <div className={PANEL}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Into">
          <Select
            ariaLabel="Into game"
            value={group.gameId ?? ""}
            onValueChange={(v) => onChange({ gameId: v || null })}
            options={[
              { value: "", label: "A new game" },
              ...games.map((g) => ({
                value: g.id,
                label: `${g.name || "Untitled game"}${g.date ? ` · ${g.date}` : ""}`,
              })),
            ]}
          />
        </Field>
        {sides && (
          <Field label={`${teamName} are`}>
            <Select
              ariaLabel={`Which team is ${teamName}`}
              value={group.us}
              onValueChange={(v) => onChange(withSide(group, v === "away" ? "away" : "home"))}
              options={[
                { value: "home", label: `${group.home.trim()} (home)` },
                { value: "away", label: `${group.away.trim()} (away)` },
              ]}
            />
          </Field>
        )}
      </div>
      {fills ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Field label="Game name" className="sm:col-span-3">
            <Input
              value={group.name ?? gameName({ ...group, date: group.date || null }, teamName)}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <Input type="date" value={group.date} onChange={(e) => onChange({ date: e.target.value })} />
          </Field>
          <Field label="Opponent">
            <Input
              value={group.opponent}
              placeholder="Opponent"
              onChange={(e) => onChange({ opponent: e.target.value })}
            />
          </Field>
          <Field label="Venue">
            <Select
              ariaLabel="Venue"
              value={group.venue}
              onValueChange={(v) => onChange({ venue: VENUES.find((venue) => venue === v) ?? "home" })}
              options={VENUES.map((v) => ({ value: v, label: VENUE_LABEL[v] }))}
            />
          </Field>
        </div>
      ) : (
        target && (
          <p className={CALLOUT_NOTE}>
            The sets take this game’s details: {[teamName, versus(target.opponent, target.venue)].join(" ")}
            {target.date && `, ${formatGameDate(target.date)}`}.
          </p>
        )
      )}
      <ul className="m-0 list-none p-0 text-sm">
        {group.sets.map((s, i) => (
          <li key={i} className="flex items-center gap-1">
            <span className="min-w-0 truncate">
              Set {s.data.meta.setNumber || "?"} · {s.data.events.length} events ·{" "}
              <span className="text-text-dim">{s.source}</span>
            </span>
            <IconButton variant="plain" size="xs" aria-label={`Remove ${s.source}`} onClick={() => onRemove(s)}>
              <X size={14} aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
      {clashes.length > 0 && (
        <p className={CALLOUT_WARN}>
          That game already has set {clashes.join(", ")}. Importing adds another copy; delete the one you don’t want
          afterwards.
        </p>
      )}
    </div>
  );
}
