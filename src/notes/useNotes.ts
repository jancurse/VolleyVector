import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import { writeWithRetries } from "../supabase/retry";
import type { NoteRow } from "../supabase/rows";
import { noteFromRow, noteToInsert } from "../supabase/rows";
import { uniqueSlug } from "../routing/slug";
import type { Space } from "../workspace/space";
import { createNote, deleteNote, moveNote, nestNote, setNote } from "./operations";
import type { Note } from "./types";

export type NotesStore = {
  notes: Note[];
  /** True until the active space's notes have loaded. */
  loading: boolean;
  /** The last load or write error, or null. */
  error: string | null;
  /** Add a note under `parentId` (`null` for a root) and return its id, so the caller can select it. */
  addNote: (parentId: string | null) => string;
  /** Insert fully-formed notes (an import; parents before children), awaited in order with retries.
   *  Resolves to null on success, or the first error message — notes inserted before it stay. */
  insertNotes: (notes: readonly Note[]) => Promise<string | null>;
  /** Commit the note editor's Done: awaited and retried, the tree updates only on success. Resolves
   *  to null on success, or the error message — the caller owns the failure UI. */
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "blocks">>) => Promise<string | null>;
  /** Remove a note and its whole subtree. Unfiling its boards is the caller's job. */
  removeNote: (id: string) => void;
  /** Re-parent a note (`null` for a root). */
  reparentNote: (id: string, parentId: string | null) => void;
  /** Reorder a note among its siblings (`dir` -1 earlier, +1 later). */
  reorderNote: (id: string, dir: -1 | 1) => void;
};

/** Notes whose tree position (parent or order) differs between two trees — the rows a structural
 *  move must write back. */
function changedPlacements(prev: readonly Note[], next: readonly Note[]): Note[] {
  const before = new Map(prev.map((t) => [t.id, t]));

  return next.filter((t) => {
    const was = before.get(t.id);

    return was !== undefined && (was.parentId !== t.parentId || was.order !== t.order);
  });
}

/** A read query for the notes of one space: a team's by team, the personal space's by owner. Grace-archived
 *  rows (deleted_at set) are hidden from every normal view; only admin recovery reads them. */
function selectSpaceNotes(space: Space, userId: string) {
  const query = supabase.from("topics").select("*").is("deleted_at", null);

  return space.kind === "team"
    ? query.eq("scope", "team").eq("team_id", space.teamId)
    : query.eq("scope", "personal").eq("owner", userId);
}

/** The active space's note tree, loaded from Supabase and written through on each edit. Like boards,
 *  edits apply optimistically and a failed write surfaces an error and refetches. */
export function useNotes(space: Space | null): NotesStore {
  const { user } = useAuth();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `addNote` returns the new id synchronously, and structural moves diff against the current tree,
  // so both read the latest notes from a ref rather than a stale closure.
  const latest = useRef(notes);

  useEffect(() => {
    latest.current = notes;
  }, [notes]);

  const refetch = useCallback(async () => {
    if (!space || !user) return;

    const { data, error: queryError } = await selectSpaceNotes(space, user.id);

    if (!queryError && data) setNotes((data as NoteRow[]).map(noteFromRow));
  }, [space, user]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!space || !user) {
        setNotes([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await selectSpaceNotes(space, user.id);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);

        return;
      }

      setNotes((data as NoteRow[]).map(noteFromRow));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [space, user]);

  const fail = useCallback(
    (message: string) => {
      setError(message);
      void refetch();
    },
    [refetch]
  );

  const addNote = useCallback(
    (parentId: string | null) => {
      const { notes: next, id } = createNote(latest.current, parentId);

      setNotes(next);

      const created = next.find((t) => t.id === id);

      if (created && space && user) {
        const scope = space.kind === "team" ? "team" : "personal";
        const teamId = space.kind === "team" ? space.teamId : null;

        void (async () => {
          const { error: writeError } = await supabase
            .from("topics")
            .insert(noteToInsert(created, user.id, scope, teamId));

          // Unique-index backstop: a slug collision (e.g. a concurrent mint) retries once with a random suffix.
          if (writeError?.code === "23505") {
            const slug = `${created.slug}-${Math.random().toString(36).slice(2, 6)}`;

            setNotes((prev) => setNote(prev, id, { slug }));

            const retry = await supabase
              .from("topics")
              .insert(noteToInsert({ ...created, slug }, user.id, scope, teamId));

            if (retry.error) fail(retry.error.message);
          } else if (writeError) {
            fail(writeError.message);
          }
        })();
      }

      return id;
    },
    [space, user, fail]
  );

  const insertNotes = useCallback(
    async (toInsert: readonly Note[]): Promise<string | null> => {
      if (!space || !user) return "No active space to import into.";

      const scope = space.kind === "team" ? "team" : "personal";
      const teamId = space.kind === "team" ? space.teamId : null;

      for (const note of toInsert) {
        const writeError = await writeWithRetries(() =>
          supabase.from("topics").insert(noteToInsert(note, user.id, scope, teamId))
        );

        if (writeError !== null) return writeError;

        setNotes((prev) => [...prev, note]);
      }

      return null;
    },
    [space, user]
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, "title" | "blocks">>): Promise<string | null> => {
      // Slugs never change on rename, except the first rename away from the creation placeholder
      // ("New note"), which mints the real slug. Real renames after that never touch it.
      const current = latest.current.find((t) => t.id === id);
      const full: Partial<Pick<Note, "title" | "blocks" | "slug">> =
        patch.title !== undefined &&
        (current?.title === "New note" || current?.title === "New topic") &&
        patch.title !== current.title
          ? {
              ...patch,
              slug: uniqueSlug(
                patch.title,
                latest.current.filter((t) => t.id !== id).map((t) => t.slug)
              ),
            }
          : patch;

      const writeError = await writeWithRetries(() => supabase.from("topics").update(full).eq("id", id));

      if (writeError === null) setNotes((prev) => setNote(prev, id, full));

      return writeError;
    },
    []
  );

  const removeNote = useCallback(
    (id: string) => {
      setNotes((prev) => deleteNote(prev, id));
      // soft_delete_topic (notes keep the legacy "topics" name server-side) grace-archives the whole
      // subtree, so a deleted note is recoverable by an admin within the window. Boards are untouched:
      // a note's board links live in its own blocks.
      void supabase
        .rpc("soft_delete_topic", { root: id })
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const persistMove = useCallback(
    (next: Note[]) => {
      setNotes(next);
      void (async () => {
        for (const t of changedPlacements(latest.current, next)) {
          const { error: writeError } = await supabase
            .from("topics")
            .update({ parent_id: t.parentId, sort_order: t.order })
            .eq("id", t.id);

          if (writeError) {
            fail(writeError.message);

            return;
          }
        }
      })();
    },
    [fail]
  );

  const reparentNote = useCallback(
    (id: string, parentId: string | null) => persistMove(nestNote(latest.current, id, parentId)),
    [persistMove]
  );

  const reorderNote = useCallback(
    (id: string, dir: -1 | 1) => persistMove(moveNote(latest.current, id, dir)),
    [persistMove]
  );

  return { notes, loading, error, addNote, insertNotes, updateNote, removeNote, reparentNote, reorderNote };
}
