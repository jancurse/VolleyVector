import type { CourtMode } from "../court/roles";
import { normalizeSteps } from "../boards/normalize";
import type { StoredStep } from "../boards/normalize";
import type { Board, BoardMarker, BoardStep } from "../boards/types";
import type { Note, NoteBlock } from "../notes/types";

// The bridge between the client model and the database. A board/note lives server-side as a row with
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
  shared: boolean;
  author_locked: boolean;
  auto_arrows: boolean;
  rotation_strict: boolean;
  share_token: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type NoteRow = {
  id: string;
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  slug: string;
  blocks: NoteBlock[];
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
  auto_arrows: boolean;
  rotation_strict: boolean;
};

export type BoardUpdate = Omit<BoardInsert, "id" | "owner" | "scope" | "team_id">;

export type NoteInsert = {
  id: string;
  owner: string | null;
  scope: Scope;
  team_id: string | null;
  title: string;
  slug: string;
  blocks: NoteBlock[];
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
    owner: row.owner,
    authorLocked: row.author_locked,
    shared: row.shared,
    teamId: row.team_id,
    autoArrows: row.auto_arrows,
    rotationStrict: row.rotation_strict,
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
    auto_arrows: board.autoArrows,
    rotation_strict: board.rotationStrict,
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
    auto_arrows: board.autoArrows,
    rotation_strict: board.rotationStrict,
  };
}

export function noteFromRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    blocks: row.blocks,
    parentId: row.parent_id,
    order: row.sort_order,
  };
}

export function noteToInsert(note: Note, owner: string, scope: Scope, teamId: string | null): NoteInsert {
  return {
    id: note.id,
    owner,
    scope,
    team_id: teamId,
    title: note.title,
    slug: note.slug,
    blocks: note.blocks,
    parent_id: note.parentId,
    sort_order: note.order,
  };
}
