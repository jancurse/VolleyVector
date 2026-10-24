import type { CourtMode } from "../court/roles";
import { normalizeMarkers, normalizeSteps } from "../boards/normalize";
import type { StoredStep } from "../boards/normalize";
import type { Board, BoardMarker, BoardStep } from "../boards/types";
import type { Game, Lineup, Position, RosterPlayer } from "../games/types";
import type { Note, NoteBlock } from "../notes/types";

// The bridge between the client model and the database. A board/note lives server-side as a row of content
// columns plus a `created_by` attribution label and a `current_revision_id` pointer; its access list and
// revisions live in their own tables. The client model carries the content, the viewer's derived
// `capability`, and the current-revision id (the base for the next commit). These functions map a row to the
// model on read and build the column subset a client may write on insert; content edits commit through the
// `commit_board`/`commit_topic` RPCs, never a direct column write.

export type Capability = "viewer" | "editor" | "owner";

export type BoardRow = {
  id: string;
  created_by: string | null;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: StoredStep[];
  tags: string[];
  auto_arrows: boolean;
  rotation_strict: boolean;
  opponent_side: boolean;
  share_token: string;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type NoteRow = {
  id: string;
  created_by: string | null;
  team_id: string | null;
  title: string;
  slug: string;
  blocks: NoteBlock[];
  parent_id: string | null;
  sort_order: number;
  current_revision_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

/** One grant on a board or note's access list: a user or a team principal, with a capability. */
export type AccessRow = {
  id: string;
  user_id: string | null;
  team_id: string | null;
  capability: Capability;
};

export type BoardInsert = {
  id: string;
  created_by: string;
  title: string;
  description: string;
  mode: CourtMode;
  markers: BoardMarker[];
  steps: BoardStep[];
  tags: string[];
  auto_arrows: boolean;
  rotation_strict: boolean;
  opponent_side: boolean;
};

export type NoteInsert = {
  id: string;
  created_by: string;
  team_id: string | null;
  title: string;
  slug: string;
  blocks: NoteBlock[];
  parent_id: string | null;
  sort_order: number;
};

export function boardFromRow(row: BoardRow, capability: Capability): Board {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mode: row.mode,
    markers: normalizeMarkers(row.markers),
    steps: normalizeSteps(row.steps),
    tags: row.tags,
    createdBy: row.created_by,
    capability,
    currentRevisionId: row.current_revision_id,
    autoArrows: row.auto_arrows,
    rotationStrict: row.rotation_strict,
    opponentSide: row.opponent_side,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

export function boardToInsert(board: Board, createdBy: string): BoardInsert {
  return {
    id: board.id,
    created_by: createdBy,
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    auto_arrows: board.autoArrows,
    rotation_strict: board.rotationStrict,
    opponent_side: board.opponentSide,
  };
}

/** The content snapshot the `commit_board` RPC unpacks back into the board's columns. */
export function boardToContent(board: Board): Record<string, unknown> {
  return {
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    auto_arrows: board.autoArrows,
    rotation_strict: board.rotationStrict,
    opponent_side: board.opponentSide,
  };
}

export function noteFromRow(row: NoteRow, capability: Capability): Note {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    blocks: row.blocks,
    parentId: row.parent_id,
    order: row.sort_order,
    capability,
    currentRevisionId: row.current_revision_id,
  };
}

export function noteToInsert(note: Note, createdBy: string, teamId: string | null): NoteInsert {
  return {
    id: note.id,
    created_by: createdBy,
    team_id: teamId,
    title: note.title,
    slug: note.slug,
    blocks: note.blocks,
    parent_id: note.parentId,
    sort_order: note.order,
  };
}

/** One append-only revision: the committed content snapshot with its author, base, and time. The content
 *  jsonb mirrors `boardToContent`, so a revision maps back to a Board/Note for read-only preview through the
 *  same surfaces as the live content. */
export type BoardRevisionRow = {
  id: string;
  board_id: string;
  content: Record<string, unknown>;
  created_by: string | null;
  base_revision_id: string | null;
  created_at: string;
};

export type NoteRevisionRow = {
  id: string;
  topic_id: string;
  content: Record<string, unknown>;
  created_by: string | null;
  base_revision_id: string | null;
  created_at: string;
};

/** A board as it stood at one revision: the snapshot content joined onto the live board's identity and the
 *  viewer's capability, so it renders read-only exactly like the current board. */
export function boardFromRevision(row: BoardRevisionRow, board: Board): Board {
  const c = row.content;

  return {
    id: board.id,
    title: (c.title as string) ?? "",
    description: (c.description as string) ?? "",
    mode: c.mode as CourtMode,
    markers: normalizeMarkers((c.markers as BoardMarker[]) ?? []),
    steps: normalizeSteps((c.steps as StoredStep[]) ?? []),
    tags: (c.tags as string[]) ?? [],
    createdBy: row.created_by,
    capability: board.capability,
    currentRevisionId: row.id,
    autoArrows: (c.auto_arrows as boolean) ?? true,
    rotationStrict: (c.rotation_strict as boolean) ?? false,
    opponentSide: (c.opponent_side as boolean) ?? false,
    createdAt: board.createdAt,
    updatedAt: Date.parse(row.created_at),
  };
}

/** A note as it stood at one revision: the snapshot content joined onto the live note's tree position. */
export function noteFromRevision(row: NoteRevisionRow, note: Note): Note {
  const c = row.content;

  return {
    id: note.id,
    title: (c.title as string) ?? "",
    slug: (c.slug as string) ?? note.slug,
    blocks: (c.blocks as NoteBlock[]) ?? [],
    parentId: note.parentId,
    order: note.order,
    capability: note.capability,
    currentRevisionId: row.id,
  };
}

export type RosterPlayerRow = {
  id: string;
  team_id: string;
  number: number;
  name: string;
  main_position: Position;
  secondary_position: Position | null;
  archived_at: string | null;
};

export function rosterPlayerFromRow(row: RosterPlayerRow): RosterPlayer {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    main: row.main_position,
    secondary: row.secondary_position,
    archived: row.archived_at !== null,
  };
}

/** The writable roster columns of a player, for an insert or an edit. */
export function rosterPlayerToRow(player: Omit<RosterPlayer, "id" | "archived">): Record<string, unknown> {
  return {
    number: player.number,
    name: player.name,
    main_position: player.main,
    secondary_position: player.secondary,
  };
}

export type GameRow = {
  id: string;
  team_id: string;
  name: string;
  played_on: string | null;
  squad: string[];
  lineups: Lineup[];
};

export function gameFromRow(row: GameRow): Game {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    date: row.played_on,
    squad: row.squad,
    lineups: row.lineups,
  };
}

/** The writable content columns of a game. */
export function gameToContent(game: Game): Record<string, unknown> {
  return { name: game.name, played_on: game.date, squad: game.squad, lineups: game.lineups };
}
