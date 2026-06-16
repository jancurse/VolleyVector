import type { Board } from "../../src/boards/types";
import type { BoardRow, Capability, NoteRow } from "../../src/supabase/rows";
import type { Note } from "../../src/notes/types";
import { SAMPLE_BOARDS, SAMPLE_NOTES } from "./sampleData";

// A tiny in-memory stand-in for the Supabase client, used to test surfaces that read through the data
// layer. It mocks only the external dependency (per the style guide), so the real stores, hooks, and
// components run against it. It seeds the team's sample library and one personal board, models the access
// list (board_access/topic_access) so a space's content reads by its principal as it would server-side, and
// answers the commit RPCs. Writes are accepted as no-ops: the stores apply edits optimistically. Row-level
// access control is not modelled here — that is the database's job and is exercised against the real database.

export const TEST_TEAM_ID = "test-team";
export const SHOWCASE_TEAM_ID = "showcase-team";
export const TEST_USER = { id: "test-user", email: "coach@volley.test" };
export const OTHER_MEMBER = { id: "player-2", email: "player@volley.test" };

// Seed content is created by someone other than the test user, so attribution reads distinctly from the
// admin god-mode the default authz grants.
const BOARD_AUTHOR = "seed-coach";

const ISO = "2026-01-01T00:00:00.000Z";

type Authz = {
  isAdmin: boolean;
  role: "coach" | "player";
  showcaseRole: "coach" | "player" | null;
  displayName: string | null;
};

const authz: Authz = { isAdmin: true, role: "coach", showcaseRole: null, displayName: "Coach Casey" };

export function setFakeAuthz(next: Partial<Authz>): void {
  Object.assign(authz, next);
}

export function resetFakeAuthz(): void {
  authz.isAdmin = true;
  authz.role = "coach";
  authz.showcaseRole = null;
  authz.displayName = "Coach Casey";
}

function toBoardRow(board: Board): BoardRow {
  return {
    id: board.id,
    created_by: BOARD_AUTHOR,
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    auto_arrows: true,
    rotation_strict: false,
    share_token: `token-${board.id}`,
    current_revision_id: `rev-${board.id}`,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    deleted_by: null,
  };
}

function toNoteRow(note: Note): NoteRow {
  return {
    id: note.id,
    created_by: TEST_USER.id,
    team_id: TEST_TEAM_ID,
    title: note.title,
    slug: note.slug,
    blocks: note.blocks,
    parent_id: note.parentId,
    sort_order: note.order,
    current_revision_id: `rev-${note.id}`,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    deleted_by: null,
  };
}

// One board in the test user's personal space, so navigating there shows a distinct library.
const PERSONAL_BOARD: BoardRow = {
  id: "personal-board-1",
  created_by: TEST_USER.id,
  title: "My Personal Position",
  description: "",
  mode: "positions",
  markers: [],
  steps: [{ id: "personal-step-1", instruction: "", positions: {} }],
  tags: [],
  auto_arrows: true,
  rotation_strict: false,
  share_token: "token-personal-1",
  current_revision_id: "rev-personal-1",
  created_at: ISO,
  updated_at: ISO,
  deleted_at: null,
  deleted_by: null,
};

// Another user's board, shared to a second user. It belongs to neither the team list nor the test user's
// personal list, so it is only reachable through its share token — what a share link does.
const SHARED_PERSONAL: BoardRow = {
  ...PERSONAL_BOARD,
  id: "shared-board-1",
  created_by: BOARD_AUTHOR,
  title: "Shared Tactic",
  share_token: "token-shared-1",
  current_revision_id: "rev-shared-1",
};

// One board in the showcase team, so the read-only Inspiration space shows a distinct library.
const SHOWCASE_BOARD: BoardRow = {
  ...PERSONAL_BOARD,
  id: "showcase-board-1",
  created_by: BOARD_AUTHOR,
  title: "Inspiration Example",
  share_token: "token-showcase-1",
  current_revision_id: "rev-showcase-1",
};

const DELETED_BOARD: BoardRow = {
  ...PERSONAL_BOARD,
  id: "deleted-board-1",
  created_by: BOARD_AUTHOR,
  title: "Archived Board",
  share_token: "token-deleted-1",
  current_revision_id: "rev-deleted-1",
  deleted_at: ISO,
  deleted_by: TEST_USER.id,
};

const DELETED_TOPIC: NoteRow = {
  ...toNoteRow(SAMPLE_NOTES[0]),
  id: "deleted-note-1",
  title: "Archived Note",
  deleted_at: ISO,
  deleted_by: TEST_USER.id,
};

type Grant = {
  id: string;
  board_id?: string;
  topic_id?: string;
  user_id: string | null;
  team_id: string | null;
  capability: Capability;
};

// The access list. A team grant places content in that team's library; a user grant in that user's personal
// space. board_by_token resolves a board only with a team grant or a grant to a non-creator user. Each grant
// carries a stable id (its principal disambiguates it on a row), so a write can target one grant by id.
const BOARD_ACCESS: Grant[] = [
  ...SAMPLE_BOARDS.map(
    (b): Grant => ({
      id: `ba-${b.id}-${TEST_TEAM_ID}`,
      board_id: b.id,
      user_id: null,
      team_id: TEST_TEAM_ID,
      capability: "owner",
    })
  ),
  {
    id: `ba-${PERSONAL_BOARD.id}-${TEST_USER.id}`,
    board_id: PERSONAL_BOARD.id,
    user_id: TEST_USER.id,
    team_id: null,
    capability: "owner",
  },
  {
    id: `ba-${SHARED_PERSONAL.id}-${OTHER_MEMBER.id}`,
    board_id: SHARED_PERSONAL.id,
    user_id: OTHER_MEMBER.id,
    team_id: null,
    capability: "owner",
  },
  {
    id: `ba-${SHOWCASE_BOARD.id}-${SHOWCASE_TEAM_ID}`,
    board_id: SHOWCASE_BOARD.id,
    user_id: null,
    team_id: SHOWCASE_TEAM_ID,
    capability: "owner",
  },
  {
    id: `ba-${DELETED_BOARD.id}-${TEST_TEAM_ID}`,
    board_id: DELETED_BOARD.id,
    user_id: null,
    team_id: TEST_TEAM_ID,
    capability: "owner",
  },
];

const TOPIC_ACCESS: Grant[] = [
  ...SAMPLE_NOTES.map(
    (n): Grant => ({
      id: `ta-${n.id}-${TEST_TEAM_ID}`,
      topic_id: n.id,
      user_id: null,
      team_id: TEST_TEAM_ID,
      capability: "owner",
    })
  ),
  {
    id: `ta-${DELETED_TOPIC.id}-${TEST_TEAM_ID}`,
    topic_id: DELETED_TOPIC.id,
    user_id: null,
    team_id: TEST_TEAM_ID,
    capability: "owner",
  },
];

// Two revisions per sample board/note: an older draft and the current one (its id matches the row's
// current_revision_id), so the history surface shows a real list with a change to summarise.
const BOARD_REVISIONS: Row[] = SAMPLE_BOARDS.flatMap((b) => [
  {
    id: `rev0-${b.id}`,
    board_id: b.id,
    content: {
      title: `${b.title} (draft)`,
      description: b.description,
      mode: b.mode,
      markers: b.markers,
      steps: b.steps,
      tags: b.tags,
      auto_arrows: true,
      rotation_strict: false,
    },
    created_by: BOARD_AUTHOR,
    base_revision_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `rev-${b.id}`,
    board_id: b.id,
    content: {
      title: b.title,
      description: b.description,
      mode: b.mode,
      markers: b.markers,
      steps: b.steps,
      tags: b.tags,
      auto_arrows: true,
      rotation_strict: false,
    },
    created_by: TEST_USER.id,
    base_revision_id: `rev0-${b.id}`,
    created_at: "2026-01-02T00:00:00.000Z",
  },
]);

const TOPIC_REVISIONS: Row[] = SAMPLE_NOTES.flatMap((n) => [
  {
    id: `rev0-${n.id}`,
    topic_id: n.id,
    content: { title: `${n.title} (draft)`, slug: n.slug, blocks: n.blocks },
    created_by: BOARD_AUTHOR,
    base_revision_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: `rev-${n.id}`,
    topic_id: n.id,
    content: { title: n.title, slug: n.slug, blocks: n.blocks },
    created_by: TEST_USER.id,
    base_revision_id: `rev0-${n.id}`,
    created_at: "2026-01-02T00:00:00.000Z",
  },
]);

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;
type DbResult = { data: unknown; error: { message: string; code?: string } | null };

const ok = (data: unknown): DbResult => ({ data, error: null });

// The access config for a content table: where its grants live, how they key back, and the embed name a
// `select("*, <embed>(...)")` carries (with the dotted `<embed>.<col>` filters the stores use).
type Access = { rows: Grant[]; key: "board_id" | "topic_id"; embed: "board_access" | "topic_access" };

const ACCESS: Record<string, Access> = {
  boards: { rows: BOARD_ACCESS, key: "board_id", embed: "board_access" },
  topics: { rows: TOPIC_ACCESS, key: "topic_id", embed: "topic_access" },
};

export type WriteCall = {
  table: string;
  op: "insert" | "update" | "delete";
  payload?: Row;
  eq: Record<string, unknown>;
};
export type RpcCall = { fn: string; params: unknown };
export type InvokeCall = { name: string; body: unknown };

export const recordedWrites: WriteCall[] = [];
export const recordedRpcs: RpcCall[] = [];
export const recordedInvokes: InvokeCall[] = [];

let failingWrites = 0;
let failingMessage = "Load failed";
let failingCode: string | undefined;
// When set, the next commit RPC reports a conflict (a null return), so the conflict path can be exercised.
let commitConflict = false;
// The next `failingCommits` commit RPCs report an error, so the editor's failure path can be exercised.
let failingCommits = 0;

export function failWrites(count: number, message = "Load failed", code?: string): void {
  failingWrites = count;
  failingMessage = message;
  failingCode = code;
}

/** Make the next commit_board/commit_topic RPC return a stale-base conflict (a null data). */
export function setCommitConflict(): void {
  commitConflict = true;
}

/** Make the next `count` commit RPCs fail with an error, so the editor's failure-and-retry path is testable. */
export function failCommits(count: number): void {
  failingCommits = count;
}

export function resetRecorded(): void {
  recordedWrites.length = 0;
  recordedRpcs.length = 0;
  recordedInvokes.length = 0;
  failingWrites = 0;
  failingCode = undefined;
  commitConflict = false;
  failingCommits = 0;
}

type Query = {
  select: (query?: string) => Query;
  insert: (payload?: Row) => Query;
  update: (payload?: Row) => Query;
  delete: () => Query;
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: readonly unknown[]) => Query;
  is: (column: string, value: unknown) => Query;
  not: (column: string, op: string, value: unknown) => Query;
  order: (column: string, opts?: { ascending?: boolean }) => Query;
  single: () => Promise<DbResult>;
  maybeSingle: () => Promise<DbResult>;
  then: (onfulfilled: (value: DbResult) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(table: string, rows: Row[], created: Row | null): Query {
  const access = ACCESS[table];
  let write = false;
  let record: WriteCall | null = null;
  let accessFilter: { field: string; value: unknown } | null = null;
  const filters: Predicate[] = [];

  // Read rows that pass every filter, attaching the embedded access grants for a content table (projected to
  // the matching grants when a dotted access filter narrowed the read, as PostgREST's inner embed would).
  const matches = (): Row[] => {
    const base = rows.filter((row) => filters.every((f) => f(row)));

    if (!access) return base;

    return base.map((row) => ({
      ...row,
      [access.embed]: access.rows.filter(
        (g) =>
          g[access.key] === row.id && (!accessFilter || g[accessFilter.field as keyof Grant] === accessFilter.value)
      ),
    }));
  };

  const begin = (op: WriteCall["op"], payload?: Row): Query => {
    write = true;
    record = { table, op, payload, eq: {} };
    recordedWrites.push(record);

    return query;
  };

  const query: Query = {
    select: () => query,
    insert: (payload) => begin("insert", payload),
    update: (payload) => begin("update", payload),
    delete: () => begin("delete"),
    eq: (column, value) => {
      if (access && column.startsWith(`${access.embed}.`)) {
        const field = column.slice(access.embed.length + 1);

        accessFilter = { field, value };
        filters.push((row) => access.rows.some((g) => g[access.key] === row.id && g[field as keyof Grant] === value));
      } else {
        filters.push((row) => row[column] === value);
        if (record) record.eq[column] = value;
      }

      return query;
    },
    in: (column, values) => {
      filters.push((row) => [...values].includes(row[column]));

      return query;
    },
    is: (column, value) => {
      filters.push((row) => (value === null ? row[column] == null : row[column] === value));

      return query;
    },
    not: (column, op, value) => {
      filters.push((row) => (op === "is" && value === null ? row[column] != null : row[column] !== value));

      return query;
    },
    // Ordering is a no-op: the callers that order also sort defensively, so seed order is enough here.
    order: () => query,
    single: () => Promise.resolve(write ? ok(created) : ok(matches()[0] ?? null)),
    maybeSingle: () => Promise.resolve(write ? ok(created) : ok(matches()[0] ?? null)),
    then: (onfulfilled, onrejected) => {
      if (write && failingWrites > 0) {
        failingWrites--;

        return Promise.resolve({ data: null, error: { message: failingMessage, code: failingCode } }).then(
          onfulfilled,
          onrejected
        );
      }

      return Promise.resolve(write ? ok(null) : ok(matches())).then(onfulfilled, onrejected);
    },
  };

  return query;
}

export const DELETED_ACCOUNT = { id: "gone-1", email: "gone@volley.test" };
export const DELETED_TEAM = { id: "old-team-1", name: "Old Team" };

// The profile rows, shared by the `profiles` table reads (display name only for an ordinary client) and
// the admin-only `admin_list_profiles` RPC (which adds email). Email is never selectable through the
// table itself server-side; the fake does not model column grants, so tests assert the client behaviour.
function profileRows(): Row[] {
  return [
    {
      id: TEST_USER.id,
      email: TEST_USER.email,
      is_admin: authz.isAdmin,
      display_name: authz.displayName,
      deleted_at: null,
    },
    { id: OTHER_MEMBER.id, email: OTHER_MEMBER.email, is_admin: false, display_name: "Player Pat", deleted_at: null },
    { id: DELETED_ACCOUNT.id, email: DELETED_ACCOUNT.email, is_admin: false, display_name: null, deleted_at: ISO },
  ];
}

function from(table: string): Query {
  switch (table) {
    case "boards":
      return makeQuery(table, [...SAMPLE_BOARDS.map(toBoardRow), PERSONAL_BOARD, SHOWCASE_BOARD, DELETED_BOARD], null);
    case "board_access":
      return makeQuery(table, BOARD_ACCESS as Row[], null);
    case "topics":
      return makeQuery(table, [...SAMPLE_NOTES.map(toNoteRow), DELETED_TOPIC], null);
    case "topic_access":
      return makeQuery(table, TOPIC_ACCESS as Row[], null);
    case "board_revisions":
      return makeQuery(table, BOARD_REVISIONS, null);
    case "topic_revisions":
      return makeQuery(table, TOPIC_REVISIONS, null);
    case "memberships":
      return makeQuery(
        table,
        [
          { team_id: TEST_TEAM_ID, user_id: TEST_USER.id, role: authz.role },
          { team_id: TEST_TEAM_ID, user_id: OTHER_MEMBER.id, role: "player" },
          ...(authz.showcaseRole
            ? [{ team_id: SHOWCASE_TEAM_ID, user_id: TEST_USER.id, role: authz.showcaseRole }]
            : []),
        ],
        null
      );
    case "teams":
      return makeQuery(
        table,
        [
          {
            id: TEST_TEAM_ID,
            name: "My Team",
            slug: "my-team",
            is_showcase: false,
            archived_at: null,
            deleted_at: null,
          },
          {
            id: SHOWCASE_TEAM_ID,
            name: "Inspiration",
            slug: "inspiration",
            is_showcase: true,
            archived_at: null,
            deleted_at: null,
          },
          {
            id: DELETED_TEAM.id,
            name: DELETED_TEAM.name,
            slug: "old-team",
            is_showcase: false,
            archived_at: null,
            deleted_at: ISO,
          },
        ],
        { id: "new-team" }
      );
    case "invites":
      return makeQuery(table, [], { token: "new-invite-token" });
    case "access_links":
      return makeQuery(table, [], { token: "new-grant-token" });
    case "profiles":
      return makeQuery(table, profileRows(), null);
    default:
      return makeQuery(table, [], null);
  }
}

const session = { user: TEST_USER };

const auth = {
  getSession: () => Promise.resolve({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signInWithPassword: () => Promise.resolve({ data: { session }, error: null }),
  updateUser: () => Promise.resolve({ data: { user: TEST_USER }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
};

const functions = {
  invoke: (name: string, opts?: { body?: unknown }) => {
    recordedInvokes.push({ name, body: opts?.body });

    return Promise.resolve({ data: { ok: true }, error: null });
  },
};

// The server-side RPCs. Commits return a fresh revision id, or null on a forced conflict; board_by_token
// mirrors the public function (a team grant or a non-creator user grant resolves); the rest are accepted so
// the client wiring can be tested without the database.
function rpc(fn: string, params: Record<string, unknown>): Promise<DbResult> {
  recordedRpcs.push({ fn, params });

  if (fn === "commit_board" || fn === "commit_topic") {
    if (failingCommits > 0) {
      failingCommits--;

      return Promise.resolve({ data: null, error: { message: "Load failed" } });
    }

    if (commitConflict) {
      commitConflict = false;

      return Promise.resolve(ok(null));
    }

    return Promise.resolve(ok(`rev-${String(params.board ?? params.topic)}-${recordedRpcs.length}`));
  }

  if (fn === "soft_delete_topic" || fn === "delete_team") return Promise.resolve(ok(null));

  // The admin-only profile list (with email); the fake serves it to any caller since it does not model
  // authz for reads.
  if (fn === "admin_list_profiles") return Promise.resolve(ok(profileRows()));

  // Sharing outside your teams. The grant-by-email RPCs return nothing whether or not an account matched
  // (the server makes a miss indistinguishable from a hit), so the fake just accepts the call. The link
  // preview and redeem RPCs return shaped rows so the redeem flow can be tested.
  if (fn === "grant_board_by_email" || fn === "grant_topic_by_email") return Promise.resolve(ok(null));
  if (fn === "access_link_preview")
    return Promise.resolve(ok([{ kind: "board", title: "Shared Tactic", capability: "editor" }]));
  if (fn === "redeem_access_link") return Promise.resolve(ok([{ board_id: SHARED_PERSONAL.id, topic_id: null }]));

  if (fn !== "board_by_token") return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });

  const all = [...SAMPLE_BOARDS.map(toBoardRow), PERSONAL_BOARD, SHARED_PERSONAL];
  const row = all.find((b) => {
    if (b.share_token !== params.token) return false;

    return BOARD_ACCESS.some((g) => g.board_id === b.id && (g.team_id !== null || g.user_id !== b.created_by));
  });

  return Promise.resolve(ok(row ? [row] : []));
}

export const supabaseFake = { auth, from, functions, rpc };
