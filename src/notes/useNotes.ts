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
  /** Commit the note editor's Done through the conflict-checked RPC. Resolves to null on success, or the
   *  error message (a readable one on a stale-base conflict). */
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "blocks">>) => Promise<string | null>;
  /** Remove a note and its whole subtree (grace-archived, recoverable by an admin). */
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

/** A read query for the notes of one space: by the space's principal on the access list (a team's grants by
 *  team, the personal space's by the user). Grace-archived rows are hidden from every normal view. */
function selectSpaceNotes(space: Space, userId: string) {
  const query = supabase.from("topics").select("*, topic_access!inner(team_id, user_id)").is("deleted_at", null);

  return space.kind === "team"
    ? query.eq("topic_access.team_id", space.teamId)
    : query.eq("topic_access.user_id", userId);
}

/** The active space's note tree, loaded from Supabase by access grant and written through on each edit. Like
 *  boards, content commits go through the conflict-checked RPC; structural moves (parent/order) are plain
 *  column writes, since they do not change the document and so record no revision. */
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

  // Insert one note row and the principal's owner grant for the active space, retrying the row on a slug
  // collision. Shared by create and import.
  const insertNote = useCallback(
    async (note: Note): Promise<string | null> => {
      if (!space || !user) return "No active space to save into.";

      const teamId = space.kind === "team" ? space.teamId : null;
      let row = note;
      let writeError = await writeWithRetries(async () => {
        const result = await supabase.from("topics").insert(noteToInsert(row, user.id, teamId));

        if (result.error?.code === "23505") {
          row = { ...note, slug: `${note.slug}-${Math.random().toString(36).slice(2, 6)}` };
          setNotes((prev) => setNote(prev, note.id, { slug: row.slug }));

          return supabase.from("topics").insert(noteToInsert(row, user.id, teamId));
        }

        return result;
      });

      if (writeError !== null) return writeError;

      const grant = {
        topic_id: note.id,
        user_id: teamId !== null ? null : user.id,
        team_id: teamId,
        capability: "owner",
      };

      writeError = await writeWithRetries(async () => {
        const result = await supabase.from("topic_access").insert(grant);

        return result.error?.code === "23505" ? { error: null } : result;
      });

      return writeError;
    },
    [space, user]
  );

  const addNote = useCallback(
    (parentId: string | null) => {
      const { notes: next, id } = createNote(latest.current, parentId);

      setNotes(next);

      const created = next.find((t) => t.id === id);

      if (created) void insertNote(created).then((writeError) => writeError && fail(writeError));

      return id;
    },
    [insertNote, fail]
  );

  const insertNotes = useCallback(
    async (toInsert: readonly Note[]): Promise<string | null> => {
      for (const note of toInsert) {
        const writeError = await insertNote(note);

        if (writeError !== null) return writeError;

        setNotes((prev) => [...prev, note]);
      }

      return null;
    },
    [insertNote]
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Pick<Note, "title" | "blocks">>): Promise<string | null> => {
      const current = latest.current.find((t) => t.id === id);

      if (!current) return "Note not found.";

      // The first rename away from the creation placeholder mints the real slug; real renames after that
      // never touch it.
      const slug =
        patch.title !== undefined &&
        (current.title === "New note" || current.title === "New topic") &&
        patch.title !== current.title
          ? uniqueSlug(
              patch.title,
              latest.current.filter((t) => t.id !== id).map((t) => t.slug)
            )
          : current.slug;
      const content = { title: patch.title ?? current.title, slug, blocks: patch.blocks ?? current.blocks };

      const { data, error: rpcError } = await supabase.rpc("commit_topic", {
        topic: id,
        content,
        base: current.currentRevisionId,
      });

      if (rpcError) return rpcError.message;
      if (data === null) return "This note was changed elsewhere. Reopen it to get the latest, then edit again.";

      setNotes((prev) => setNote(prev, id, { ...patch, slug, currentRevisionId: data as string }));

      return null;
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
