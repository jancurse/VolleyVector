import { useEffect, useState } from "react";

import type { Board } from "../boards/types";
import type { Note } from "../notes/types";
import { supabase } from "../supabase/client";
import type { BoardRevisionRow, NoteRevisionRow } from "../supabase/rows";
import { boardFromRevision, noteFromRevision } from "../supabase/rows";
import { changeSummary, diffBoard, diffNote } from "./diff";

// Loads a board or note's revision list, newest first, mapping each snapshot back to a Board/Note for
// read-only preview and pairing it with its author's name and a change summary against the previous
// revision. History is read-only here; the writes (commit, restore) go through the stores' commit RPCs.

/** One entry in a board's history: the snapshot as a renderable board, plus its metadata and a summary of
 *  what it changed from the revision before it. */
export type BoardRevisionEntry = {
  id: string;
  board: Board;
  authorName: string | null;
  createdAt: number;
  summary: string;
};

export type NoteRevisionEntry = {
  id: string;
  note: Note;
  authorName: string | null;
  createdAt: number;
  summary: string;
};

type RevisionState<T> = { entries: T[]; loading: boolean; error: string | null };

type RevisionRow = { id: string; created_by: string | null; created_at: string };

/** The metadata shared by every entry, set apart from the versioned item it carries. */
type EntryMeta = { authorName: string | null; createdAt: number; summary: string };

/** What separates a board's history from a note's: the revisions table and its id column, the mapper from a
 *  snapshot row to a versioned item, the diff between two versions, and how each version sits in its entry. */
type RevisionConfig<TItem, TRow extends RevisionRow, TEntry> = {
  table: string;
  idColumn: string;
  fromRevision: (row: TRow, item: TItem) => TItem;
  diff: (before: TItem, after: TItem) => string[];
  toEntry: (id: string, version: TItem, meta: EntryMeta) => TEntry;
};

/** Display names for a set of author ids, so the list can name each commit. Unknown or nameless authors are
 *  simply absent from the map. */
async function authorNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => id !== null))];

  if (unique.length === 0) return new Map();

  const { data } = await supabase.from("profiles").select("id, display_name").in("id", unique);
  const names = new Map<string, string>();

  for (const row of (data as { id: string; display_name: string | null }[] | null) ?? []) {
    if (row.display_name) names.set(row.id, row.display_name);
  }

  return names;
}

/** Loads an item's revision list, newest first, mapping each snapshot back to a versioned item and pairing it
 *  with its author's name and a change summary against the previous revision. */
function useRevisions<TItem extends { id: string }, TRow extends RevisionRow, TEntry>(
  item: TItem | null,
  config: RevisionConfig<TItem, TRow, TEntry>
): RevisionState<TEntry> {
  const [state, setState] = useState<RevisionState<TEntry>>({ entries: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!item) {
        setState({ entries: [], loading: false, error: null });

        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from(config.table)
        .select("*")
        .eq(config.idColumn, item.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setState({ entries: [], loading: false, error: error.message });

        return;
      }

      const rows = ((data as TRow[] | null) ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const names = await authorNames(rows.map((r) => r.created_by));

      if (!active) return;

      const versions = rows.map((row) => config.fromRevision(row, item));
      const entries = rows.map((row, i) =>
        config.toEntry(row.id, versions[i], {
          authorName: row.created_by ? (names.get(row.created_by) ?? null) : null,
          createdAt: Date.parse(row.created_at),
          summary: i + 1 < versions.length ? changeSummary(config.diff(versions[i + 1], versions[i])) : "Created",
        })
      );

      setState({ entries, loading: false, error: null });
    })();

    return () => {
      active = false;
    };
  }, [item, config]);

  return state;
}

const BOARD_REVISIONS: RevisionConfig<Board, BoardRevisionRow, BoardRevisionEntry> = {
  table: "board_revisions",
  idColumn: "board_id",
  fromRevision: boardFromRevision,
  diff: diffBoard,
  toEntry: (id, board, base) => ({ id, board, ...base }),
};

const NOTE_REVISIONS: RevisionConfig<Note, NoteRevisionRow, NoteRevisionEntry> = {
  table: "topic_revisions",
  idColumn: "topic_id",
  fromRevision: noteFromRevision,
  diff: diffNote,
  toEntry: (id, note, base) => ({ id, note, ...base }),
};

export function useBoardRevisions(board: Board | null): RevisionState<BoardRevisionEntry> {
  return useRevisions(board, BOARD_REVISIONS);
}

export function useNoteRevisions(note: Note | null): RevisionState<NoteRevisionEntry> {
  return useRevisions(note, NOTE_REVISIONS);
}
