import type { CourtMode } from "../court/roles";
import type { Board, BoardMarker, BoardStep } from "../boards/types";
import type { Topic, TopicBlock } from "../topics/types";

// The bridge between the client model and the database. A board/topic lives server-side as a row with
// extra placement and access columns (owner, scope, team, lock, token, timestamps); the client model
// carries only the content. These functions map a row to the model on read, and build the column
// subset a client may write on insert/update. The owner, scope, lock, token, and timestamps are set or
// minted server-side and are never written from here.

export type Scope = "team" | "personal";

export type BoardRow = {
  id: string;
  owner: string;
  scope: Scope;
  team_id: string | null;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: BoardStep[];
  tags: string[];
  topic_id: string | null;
  shared: boolean;
  author_locked: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
};

export type TopicRow = {
  id: string;
  owner: string;
  scope: Scope;
  team_id: string | null;
  title: string;
  blocks: TopicBlock[];
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BoardInsert = {
  id: string;
  owner: string;
  scope: "team";
  team_id: string;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: BoardStep[];
  tags: string[];
  topic_id: string | null;
};

export type BoardUpdate = Omit<BoardInsert, "id" | "owner" | "scope" | "team_id">;

export type TopicInsert = {
  id: string;
  owner: string;
  scope: "team";
  team_id: string;
  title: string;
  blocks: TopicBlock[];
  parent_id: string | null;
  sort_order: number;
};

export function boardFromRow(row: BoardRow): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    markers: row.markers,
    steps: row.steps,
    tags: row.tags,
    topicId: row.topic_id,
    owner: row.owner,
    authorLocked: row.author_locked,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

export function boardToInsert(board: Board, owner: string, teamId: string): BoardInsert {
  return {
    id: board.id,
    owner,
    scope: "team",
    team_id: teamId,
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    topic_id: board.topicId,
  };
}

export function boardToUpdate(board: Board): BoardUpdate {
  return {
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    topic_id: board.topicId,
  };
}

export function topicFromRow(row: TopicRow): Topic {
  return {
    id: row.id,
    title: row.title,
    blocks: row.blocks,
    parentId: row.parent_id,
    order: row.sort_order,
  };
}

export function topicToInsert(topic: Topic, owner: string, teamId: string): TopicInsert {
  return {
    id: topic.id,
    owner,
    scope: "team",
    team_id: teamId,
    title: topic.title,
    blocks: topic.blocks,
    parent_id: topic.parentId,
    sort_order: topic.order,
  };
}
