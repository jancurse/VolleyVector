import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "../auth/useAuth";
import { supabase } from "../supabase/client";
import type { TopicRow } from "../supabase/rows";
import { topicFromRow, topicToInsert } from "../supabase/rows";
import { createTopic, deleteTopic, moveTopic, nestTopic, setTopic } from "./operations";
import type { Topic } from "./types";

export type TopicsStore = {
  topics: Topic[];
  /** True until the active team's topics have loaded. */
  loading: boolean;
  /** The last load or write error, or null. */
  error: string | null;
  /** Add a topic under `parentId` (`null` for a root) and return its id, so the caller can select it. */
  addTopic: (parentId: string | null) => string;
  updateTopic: (id: string, patch: Partial<Pick<Topic, "title" | "blocks">>) => void;
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

/** The active team's topic tree, loaded from Supabase and written through on each edit. Like boards,
 *  edits apply optimistically and a failed write surfaces an error and refetches. */
export function useTopics(teamId: string | null): TopicsStore {
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
    if (!teamId) return;

    const { data, error: queryError } = await supabase
      .from("topics")
      .select("*")
      .eq("scope", "team")
      .eq("team_id", teamId);

    if (!queryError && data) setTopics((data as TopicRow[]).map(topicFromRow));
  }, [teamId]);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!teamId) {
        setTopics([]);
        setLoading(false);

        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("topics")
        .select("*")
        .eq("scope", "team")
        .eq("team_id", teamId);

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
  }, [teamId]);

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

      if (created && teamId && user) {
        void supabase
          .from("topics")
          .insert(topicToInsert(created, user.id, teamId))
          .then(({ error: writeError }) => writeError && fail(writeError.message));
      }

      return id;
    },
    [teamId, user, fail]
  );

  const updateTopic = useCallback(
    (id: string, patch: Partial<Pick<Topic, "title" | "blocks">>) => {
      setTopics((prev) => setTopic(prev, id, patch));
      void supabase
        .from("topics")
        .update(patch)
        .eq("id", id)
        .then(({ error: writeError }) => writeError && fail(writeError.message));
    },
    [fail]
  );

  const removeTopic = useCallback(
    (id: string) => {
      setTopics((prev) => deleteTopic(prev, id));
      // The row's ON DELETE CASCADE removes the whole subtree server-side; boards return to Unfiled
      // via the topic_id ON DELETE SET NULL.
      void supabase
        .from("topics")
        .delete()
        .eq("id", id)
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
