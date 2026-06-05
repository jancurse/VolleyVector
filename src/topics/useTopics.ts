import { useCallback, useEffect, useRef, useState } from "react";

import { createTopic, deleteTopic, moveTopic, nestTopic, setTopic } from "./operations";
import { loadTopics, SAMPLE_TOPICS, saveTopics } from "./storage";
import type { Topic } from "./types";

const SAVE_DEBOUNCE_MS = 300;

export type TopicsStore = {
  topics: Topic[];
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

/** The topic tree, seeded on first run and persisted to localStorage after edits settle. */
export function useTopics(): TopicsStore {
  const [topics, setTopics] = useState<Topic[]>(() => loadTopics() ?? SAMPLE_TOPICS);

  // `addTopic` returns the new id synchronously, so it reads the latest topics from a ref.
  const latest = useRef(topics);

  useEffect(() => {
    latest.current = topics;

    const handle = setTimeout(() => saveTopics(topics), SAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [topics]);

  const addTopic = useCallback((parentId: string | null) => {
    const { topics: next, id } = createTopic(latest.current, parentId);

    setTopics(next);

    return id;
  }, []);

  const updateTopic = useCallback(
    (id: string, patch: Partial<Pick<Topic, "title" | "blocks">>) => setTopics((prev) => setTopic(prev, id, patch)),
    []
  );

  const removeTopic = useCallback((id: string) => setTopics((prev) => deleteTopic(prev, id)), []);

  const reparentTopic = useCallback(
    (id: string, parentId: string | null) => setTopics((prev) => nestTopic(prev, id, parentId)),
    []
  );

  const reorderTopic = useCallback((id: string, dir: -1 | 1) => setTopics((prev) => moveTopic(prev, id, dir)), []);

  return { topics, addTopic, updateTopic, removeTopic, reparentTopic, reorderTopic };
}
