import type { CourtMode } from "../court/roles";
import { normalizeSteps } from "../boards/normalize";
import type { StoredStep } from "../boards/normalize";
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
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: StoredStep[];
  tags: string[];
  topic_id: string | null;
  shared: boolean;
  author_locked: boolean;
  auto_arrows: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type TopicRow = {
  id: string;
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  slug: string;
  blocks: TopicBlock[];
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type BoardInsert = {
  id: string;
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: BoardStep[];
  tags: string[];
  topic_id: string | null;
  auto_arrows: boolean;
};

export type BoardUpdate = Omit<BoardInsert, "id" | "owner" | "scope" | "team_id">;

export type TopicInsert = {
  id: string;
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  slug: string;
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
    steps: normalizeSteps(row.steps),
    tags: row.tags,
    topicId: row.topic_id,
    owner: row.owner,
    authorLocked: row.author_locked,
    shared: row.shared,
    teamId: row.team_id,
    autoArrows: row.auto_arrows,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

export function boardToInsert(board: Board, owner: string, scope: Scope, teamId: string | null): BoardInsert {
  return {
    id: board.id,
    owner,
    scope,
    team_id: teamId,
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    topic_id: board.topicId,
    auto_arrows: board.autoArrows,
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
    auto_arrows: board.autoArrows,
  };
}

export function topicFromRow(row: TopicRow): Topic {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    blocks: row.blocks,
    parentId: row.parent_id,
    order: row.sort_order,
  };
}

export function topicToInsert(topic: Topic, owner: string, scope: Scope, teamId: string | null): TopicInsert {
  return {
    id: topic.id,
    owner,
    scope,
    team_id: teamId,
    title: topic.title,
    slug: topic.slug,
    blocks: topic.blocks,
    parent_id: topic.parentId,
    sort_order: topic.order,
  };
}
