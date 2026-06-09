// A Topic is one node in the coach-curated tree that organises the library. Topics nest to arbitrary
// depth through a nullable parent, and each reads as a document: an ordered list of blocks that
// interleave markdown prose with groups of board cards. A board's home topic lives on the board
// (Board.topicId), so a topic never owns membership — a `boards` block's ids are only placement
// hints, intersected with the topic's real members at render, never the source of truth.

/** One block in a topic's document: markdown prose, or a group of board cards. */
export type TopicBlock =
  | { id: string; kind: "markdown"; text: string }
  | { id: string; kind: "boards"; boardIds: string[] };

export type Topic = {
  id: string;
  title: string;
  /** The topic's URL handle: minted once at creation, stable across renames. */
  slug: string;
  /** The topic's document: markdown and board-group blocks in the coach's chosen order. */
  blocks: TopicBlock[];
  /** Parent topic id, or null for a top-level (root) topic. */
  parentId: string | null;
  /** Manual order among its siblings (the topics that share its parent). */
  order: number;
};
