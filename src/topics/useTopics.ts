import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import { writeWithRetries } from "../supabase/retry";
import type { TopicRow } from "../supabase/rows";
import { topicFromRow, topicToInsert } from "../supabase/rows";
import { uniqueSlug } from "../routing/slug";
import type { Space } from "../workspace/space";
import { createTopic, deleteTopic, moveTopic, nestTopic, setTopic } from "./operations";
import type { Topic } from "./types";

export type TopicsStore = {
  topics: Topic[];
  /** True until the active space's topics have loaded. */
  loading: boolean;
  /** The last load or write error, or null. */
  error: string | null;
  /** Add a topic under `parentId` (`null` for a root) and return its id, so the caller can select it. */
  addTopic: (parentId: string | null) => string;
  /** Commit the topic editor's Done: awaited and retried, the tree updates only on success. Resolves
   *  to null on success, or the error message — the caller owns the failure UI. */
  updateTopic: (id: string, patch: Partial<Pick<Topic, "title" | "blocks">>) => Promise<string | null>;
  /** Remove a topic and its whole subtree. Unfiling its boards is the caller's job. */
  removeTopic: (id: string) => void;
  /** Re-parent a topic (`null` for a root). */
  reparentTopic: (id: string, parentId: string | null) => void;
  /** Reorder a topic among its siblings (`dir` -1 earlier, +1 later). */
  reorderTopic: (id: string, dir: -1 | 1) => void;
};

/** Topics whose tree position (parent or order) differs between two trees — the rows a structural
 *  move must write back. */
function changedPlacements(prev: readonly Topic[], next: readonly Topic[]): Topic[] {
  const before = new Map(prev.map((t) => [t.id, t]));

  return next.filter((t) => {
    const was = before.get(t.id);

    return was !== undefined && (was.parentId !== t.parentId || was.order !== t.order);
  });
}

/** A read query for the topics of one space: a team's by team, the personal space's by owner. Grace-archived
 *  rows (deleted_at set) are hidden from every normal view; only admin recovery reads them. */
function selectSpaceTopics(space: Space, userId: string) {
  const query = supabase.from("topics").select("*").is("deleted_at", null);

  return space.kind === "team"
    ? query.eq("scope", "team").eq("team_id", space.teamId)
    : query.eq("scope", "personal").eq("owner", userId);
}

/** The active space's topic tree, loaded from Supabase and written through on each edit. Like boards,
 *  edits apply optimistically and a failed write surfaces an error and refetches. */
export function useTopics(space: Space | null): TopicsStore {
  const { user } = useAuth();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `addTopic` returns the new id synchronously, and structural moves diff against the current tree,
  // so both read the latest topics from a ref rather than a stale closure.
  const latest = useRef(topics);

  useEffect(() => {
    latest.current = topics;
  }, [topics]);

  const refetch = useCallback(async () => {
    if (!space || !user) return;

    const { data, error: queryError } = await selectSpaceTopics(space, user.id);

    if (!queryError && data) setTopics((data as TopicRow[]).map(topicFromRow));
  }, [space, user]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!space || !user) {
        setTopics([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await selectSpaceTopics(space, user.id);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setLoading(false);

        return;
      }

      setTopics((data as TopicRow[]).map(topicFromRow));
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

  const addTopic = useCallback(
    (parentId: string | null) => {
      const { topics: next, id } = createTopic(latest.current, parentId);

      setTopics(next);

      const created = next.find((t) => t.id === id);

      if (created && space && user) {
        const scope = space.kind === "team" ? "team" : "personal";
        const teamId = space.kind === "team" ? space.teamId : null;

        void (async () => {
          const { error: writeError } = await supabase
            .from("topics")
            .insert(topicToInsert(created, user.id, scope, teamId));

          // Unique-index backstop: a slug collision (e.g. a concurrent mint) retries once with a random suffix.
          if (writeError?.code === "23505") {
            const slug = `${created.slug}-${Math.random().toString(36).slice(2, 6)}`;

            setTopics((prev) => setTopic(prev, id, { slug }));

            const retry = await supabase
              .from("topics")
              .insert(topicToInsert({ ...created, slug }, user.id, scope, teamId));

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

  const updateTopic = useCallback(
    async (id: string, patch: Partial<Pick<Topic, "title" | "blocks">>): Promise<string | null> => {
      // Slugs never change on rename, except the first rename away from the creation placeholder
      // ("New topic"), which mints the real slug. Real renames after that never touch it.
      const current = latest.current.find((t) => t.id === id);
      const full: Partial<Pick<Topic, "title" | "blocks" | "slug">> =
        patch.title !== undefined && current?.title === "New topic" && patch.title !== current.title
          ? {
              ...patch,
              slug: uniqueSlug(
                patch.title,
                latest.current.filter((t) => t.id !== id).map((t) => t.slug)
              ),
            }
          : patch;

      const writeError = await writeWithRetries(() => supabase.from("topics").update(full).eq("id", id));

      if (writeError === null) setTopics((prev) => setTopic(prev, id, full));

      return writeError;
    },
    []
  );

  const removeTopic = useCallback(
    (id: string) => {
      setTopics((prev) => deleteTopic(prev, id));
      // soft_delete_topic grace-archives the whole subtree server-side and returns its member boards to
      // Unfiled (topic_id = null), so a deleted topic is recoverable by an admin within the window.
      void supabase
        .rpc("soft_delete_topic", { root: id })
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const persistMove = useCallback(
    (next: Topic[]) => {
      setTopics(next);
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

  const reparentTopic = useCallback(
    (id: string, parentId: string | null) => persistMove(nestTopic(latest.current, id, parentId)),
    [persistMove]
  );

  const reorderTopic = useCallback(
    (id: string, dir: -1 | 1) => persistMove(moveTopic(latest.current, id, dir)),
    [persistMove]
  );

  return { topics, loading, error, addTopic, updateTopic, removeTopic, reparentTopic, reorderTopic };
}
