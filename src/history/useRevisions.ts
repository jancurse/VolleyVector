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

export function useBoardRevisions(board: Board | null): RevisionState<BoardRevisionEntry> {
  const [state, setState] = useState<RevisionState<BoardRevisionEntry>>({ entries: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!board) {
        setState({ entries: [], loading: false, error: null });

        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from("board_revisions")
        .select("*")
        .eq("board_id", board.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setState({ entries: [], loading: false, error: error.message });

        return;
      }

      const rows = ((data as BoardRevisionRow[] | null) ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const names = await authorNames(rows.map((r) => r.created_by));

      if (!active) return;

      const boards = rows.map((row) => boardFromRevision(row, board));
      const entries = rows.map((row, i) => ({
        id: row.id,
        board: boards[i],
        authorName: row.created_by ? (names.get(row.created_by) ?? null) : null,
        createdAt: Date.parse(row.created_at),
        summary: i + 1 < boards.length ? changeSummary(diffBoard(boards[i + 1], boards[i])) : "Created",
      }));

      setState({ entries, loading: false, error: null });
    })();

    return () => {
      active = false;
    };
  }, [board]);

  return state;
}

export function useNoteRevisions(note: Note | null): RevisionState<NoteRevisionEntry> {
  const [state, setState] = useState<RevisionState<NoteRevisionEntry>>({ entries: [], loading: true, error: null });

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!note) {
        setState({ entries: [], loading: false, error: null });

        return;
      }

      setState((s) => ({ ...s, loading: true, error: null }));

      const { data, error } = await supabase
        .from("topic_revisions")
        .select("*")
        .eq("topic_id", note.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (error) {
        setState({ entries: [], loading: false, error: error.message });

        return;
      }

      const rows = ((data as NoteRevisionRow[] | null) ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const names = await authorNames(rows.map((r) => r.created_by));

      if (!active) return;

      const noteVersions = rows.map((row) => noteFromRevision(row, note));
      const entries = rows.map((row, i) => ({
        id: row.id,
        note: noteVersions[i],
        authorName: row.created_by ? (names.get(row.created_by) ?? null) : null,
        createdAt: Date.parse(row.created_at),
        summary:
          i + 1 < noteVersions.length ? changeSummary(diffNote(noteVersions[i + 1], noteVersions[i])) : "Created",
      }));

      setState({ entries, loading: false, error: null });
    })();

    return () => {
      active = false;
    };
  }, [note]);

  return state;
}
