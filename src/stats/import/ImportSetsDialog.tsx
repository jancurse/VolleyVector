import { useRef, useState } from "react";
import type { JSX } from "react";

import type { Game, RosterPlayer } from "../../games/types";
import type { PlayerDraft } from "../../games/useRoster";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { CALLOUT_NOTE, CALLOUT_WARN, MUTED, PANEL_TITLE } from "../../ui/styles";
import { FileButton } from "../../ui/FileButton";
import { ImportGroupRow } from "./ImportGroupRow";
import { PlayerMatches } from "./PlayerMatches";
import { renameClashes, renamePlayers, rosterSpellingsOf, sameName, squadNames, syncWithGame } from "../gameSets";
import { clashingSets, gameName, groupImports, isBlankGame, setNumberOf } from "../importSets";
import { choiceProblems, choiceRenames, defaultChoices, newPlayers, unmatchedNames } from "../matchPlayers";
import type { PlayerChoice } from "../matchPlayers";
import type { ImportedSet, ImportGroup } from "../importSets";
import type { SetSummary } from "../types";
import { parseImport } from "../store";
import type { AppData } from "../types";

type ImportSetsDialogProps = {
  teamName: string;
  games: readonly Game[];
  sets: readonly SetSummary[];
  roster: readonly RosterPlayer[];
  /** Start every group in this game (opened from a game's page). */
  intoGameId?: string;
  createGame: (
    fields: Pick<Game, "name" | "date" | "opponent" | "venue" | "squad">
  ) => Promise<{ game: Game | null; error: string | null }>;
  saveGame: (game: Game) => Promise<{ error: string | null }>;
  /** Save a set under `id`; saving the same set under the same id again is harmless. */
  createSet: (gameId: string, data: AppData, id: string) => Promise<{ error: string | null }>;
  addPlayers: (drafts: readonly PlayerDraft[]) => Promise<{ error: string | null; added: RosterPlayer[] }>;
  onClose: (imported: boolean) => void;
};

/**
 * Exported set files grouped into games,
 * previewed, then saved. A new or blank game is filled in from the files, and the players they name join its
 * squad: the roster ones as they are, the rest added to the roster or matched to someone on it. Each set is
 * stored in its game's terms: the game's teams and date, and the roster's names.
 */
export function ImportSetsDialog({
  teamName,
  games,
  sets,
  roster,
  intoGameId,
  createGame,
  saveGame,
  createSet,
  addPlayers,
  onClose,
}: ImportSetsDialogProps): JSX.Element {
  const [files, setFiles] = useState<ImportedSet[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [groups, setGroups] = useState<ImportGroup[]>([]);
  const [choices, setChoices] = useState<Record<string, PlayerChoice>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What an import that stopped part-way already saved, so trying again carries on instead of saving it twice.
  const saved = useRef({ games: new Map<string, Game>(), ids: new Map<ImportedSet, string>() });

  // A group already shown keeps the edits made to it; only its sets and players follow the files.
  const regroup = (chosen: ImportedSet[]) => {
    const grouped = groupImports(chosen, teamName, games);
    const unmatched = unmatchedNames(
      grouped.flatMap((g) => g.players),
      roster
    );

    setGroups((shown) =>
      grouped.map((g) => {
        const kept = shown.find((s) => s.key === g.key);

        return kept ? { ...kept, sets: g.sets, players: g.players } : intoGameId ? { ...g, gameId: intoGameId } : g;
      })
    );
    setChoices((kept) => ({ ...kept, ...defaultChoices(unmatched, roster, kept) }));
  };

  const pick = async (list: File[]) => {
    const read: ImportedSet[] = [];
    const bad: string[] = [];

    for (const file of list) {
      try {
        read.push({ source: file.name, data: parseImport(JSON.parse(await file.text())) });
      } catch {
        bad.push(file.name);
      }
    }

    const chosen = [
      ...files,
      ...read.filter((r) =>
        files.every((f) => f.source !== r.source || JSON.stringify(f.data) !== JSON.stringify(r.data))
      ),
    ];

    setFiles(chosen);
    setSkipped(bad);
    regroup(chosen);
  };

  const remove = (set: ImportedSet) => {
    const chosen = files.filter((f) => f !== set);

    setFiles(chosen);
    regroup(chosen);
  };

  const edit = (key: string, change: Partial<ImportGroup>) =>
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...change } : g)));

  const total = groups.reduce((n, g) => n + g.sets.length, 0);
  const names = groups.flatMap((g) => g.players);
  const notOnRoster = unmatchedNames(names, roster);
  const picked = Object.fromEntries(notOnRoster.map((n) => [n, choices[n]!]));
  const allSets = groups.flatMap((g) => g.sets.map((s) => s.data));
  const spellings = rosterSpellingsOf(names, roster);
  const problems = choiceProblems(picked, allSets, roster);
  // Taking the roster's spelling must not turn two players of a set into one.
  const merges = allSets
    .filter((d) => renameClashes(d, spellings).length)
    .map((d) => `Set ${d.meta.setNumber || "?"} names one roster player twice, in two spellings. Fix the file first.`);
  const existingSetNumbers = (gameId: string) => sets.filter((s) => s.gameId === gameId).map((s) => s.setNumber);
  const fills = (g: ImportGroup) => {
    const existing = games.find((x) => x.id === g.gameId);

    return !existing || isBlankGame(existing, existingSetNumbers(existing.id).length);
  };

  const run = async () => {
    setError(null);

    try {
      let players = roster;
      const adding = newPlayers(picked);

      if (adding.length) {
        setProgress("Adding players to the roster…");

        const { error, added } = await addPlayers(adding);

        if (error) throw new Error(error);

        players = [...roster, ...added];
      }

      const renames = new Map([...spellings, ...choiceRenames(picked, players)]);
      // The games as this import leaves them, so a second group into one game builds on the first.
      const current = new Map([...games, ...saved.current.games.values()].map((x) => [x.id, x]));
      const numbers = new Map<string, number[]>();

      for (const g of groups) {
        const label = `${g.date} ${g.opponent}`.trim() || "the game";

        setProgress(`Saving ${label}…`);

        const renamed = g.sets.map((s) => renamePlayers(s.data, renames));
        const named = new Set(renamed.flatMap((d) => d.players));
        const squad = players
          .filter((p) => !p.archived && [...named].some((n) => sameName(p.name, n)))
          .map((p) => p.id);
        const details = {
          name: g.name ?? gameName({ ...g, date: g.date || null }, teamName),
          date: g.date || null,
          opponent: g.opponent,
          venue: g.venue,
        };
        const existing = current.get(g.gameId ?? saved.current.games.get(g.key)?.id ?? "");
        let game: Game;

        if (existing) {
          const fill = !saved.current.games.has(g.key) && fills(g) && !numbers.has(existing.id);

          game = { ...existing, ...(fill && details), squad: [...new Set([...existing.squad, ...squad])] };

          if (fill || game.squad.length !== existing.squad.length) {
            const { error } = await saveGame(game);

            if (error) throw new Error(error);
          }
        } else {
          const created = await createGame({ ...details, squad });

          if (!created.game) throw new Error(created.error ?? "Couldn’t create the game.");

          game = created.game;
        }

        current.set(game.id, game);
        saved.current.games.set(g.key, game);

        // A set file with no set number takes the next one free in the game, after those the files do number.
        const taken = [...(numbers.get(game.id) ?? existingSetNumbers(game.id)), ...renamed.map(setNumberOf)];

        numbers.set(game.id, taken);

        for (const [i, renamedSet] of renamed.entries()) {
          const source = g.sets[i]!;
          const number = setNumberOf(renamedSet) || Math.max(0, ...taken) + 1;
          const data = { ...renamedSet, meta: { ...renamedSet.meta, setNumber: String(number) } };
          const id = saved.current.ids.get(source) ?? crypto.randomUUID();

          saved.current.ids.set(source, id);
          taken.push(number);
          setProgress(`Saving ${label}, set ${number}…`);

          const { error } = await createSet(game.id, syncWithGame(data, game, teamName, squadNames(game, players)), id);

          if (error) throw new Error(error);
        }
      }

      onClose(true);
    } catch (e) {
      // What was saved stays saved; the list reloads so it shows.
      setError(
        `${e instanceof Error ? e.message : String(e)} Sets saved before this are kept. Import again to save the rest.`
      );
      setProgress(null);
    }
  };

  return (
    <Dialog
      open
      size="wide"
      onOpenChange={(open) => !open && !progress && onClose(error !== null)}
      title="Import set files"
    >
      <p className="m-0 text-base text-text-dim">
        Choose the JSON files exported from the stats tracker (<b>Export JSON</b>), for one game or several. Choosing
        again adds to the files already chosen, so they can come from different folders. Sets with the same date and
        teams go into one game. Check the games below before importing.
      </p>
      <div className="flex">
        <FileButton multiple onFiles={(list) => void pick(list)}>
          Choose files…
        </FileButton>
      </div>
      {skipped.length > 0 && <p className={CALLOUT_WARN}>Not set exports, skipped: {skipped.join(", ")}</p>}
      {groups.length === 0 && skipped.length === 0 && <p className={MUTED}>No files chosen yet.</p>}

      {groups.map((g) => (
        <ImportGroupRow
          key={g.key}
          group={g}
          teamName={teamName}
          games={games}
          fills={fills(g)}
          clashes={clashingSets(g, existingSetNumbers)}
          onChange={(change) => edit(g.key, change)}
          onRemove={remove}
        />
      ))}

      {notOnRoster.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="unmatched-title">
          <h3 id="unmatched-title" className={PANEL_TITLE}>
            Not on the {teamName} roster
          </h3>
          <p className={CALLOUT_NOTE}>
            Add each player to the roster, or pick who they are on it. The sets are stored with the roster’s names.
          </p>
          <PlayerMatches
            names={notOnRoster}
            choices={picked}
            sets={allSets}
            roster={roster}
            onChange={(name, choice) => setChoices((c) => ({ ...c, [name]: choice }))}
          />
        </section>
      )}

      {merges.length > 0 && <p className={CALLOUT_WARN}>{[...new Set(merges)].join(" ")}</p>}
      {error && <p className={CALLOUT_WARN}>{error}</p>}
      {progress && <p className="m-0 text-sm text-text-dim">{progress}</p>}
      <div className="flex justify-end gap-3">
        <Button variant="ghost" paired onClick={() => onClose(error !== null)} disabled={!!progress}>
          {error ? "Close" : "Cancel"}
        </Button>
        <Button
          onClick={() => void run()}
          disabled={
            !total || !!progress || problems.length > 0 || merges.length > 0 || groups.some((g) => !g.gameId && !g.date)
          }
        >
          Import {total} {total === 1 ? "set" : "sets"}
        </Button>
      </div>
    </Dialog>
  );
}
