// A Topic is one node in the coach-curated tree that organises the library. Topics nest to arbitrary
// depth through a nullable parent, and each carries an optional markdown explanation of its subject.
// A board's home topic lives on the board (Board.topicId), so a topic never lists its own boards —
// that single reference stays the one source of truth for membership.

export type Topic = {
  id: string;
  title: string;
  /** Markdown explanation of the topic's subject. */
  body: string;
  /** Parent topic id, or null for a top-level (root) topic. */
  parentId: string | null;
  /** Manual order among its siblings (the topics that share its parent). */
  order: number;
};
