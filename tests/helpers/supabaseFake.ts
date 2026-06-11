import type { Board } from "../../src/boards/types";
import type { BoardRow, TopicRow } from "../../src/supabase/rows";
import type { Topic } from "../../src/topics/types";
import { SAMPLE_BOARDS, SAMPLE_TOPICS } from "./sampleData";

// A tiny in-memory stand-in for the Supabase client, used to test surfaces that read through the data
// layer. It mocks only the external dependency (per the style guide), so the real stores, hooks, and
// components run against it. It seeds the team's sample library and one personal board, and applies the
// `.eq`/`.in` filters a query carries, so team-versus-personal scoping reads as it would server-side.
// Writes are accepted as no-ops: the stores apply edits optimistically, so the UI reflects them without
// the fake persisting. Row-level access control is not modelled here — that is the database's job and is
// exercised against the real database, not this fake.

export const TEST_TEAM_ID = "test-team";
export const SHOWCASE_TEAM_ID = "showcase-team";
export const TEST_USER = { id: "test-user", email: "coach@volley.test" };

// Seed team boards are authored by someone other than the test user, so ownership-based rules (the
// author lock, read-only for non-authors) can be exercised distinctly from the admin god-mode.
const BOARD_AUTHOR = "seed-coach";

const ISO = "2026-01-01T00:00:00.000Z";

// The test user's standing in the active team. Defaults to an admin coach (full access) with a set
// display name and no showcase membership; a test can lower the role, clear the name to exercise the
// first-login prompt, or grant a showcase role, and resetFakeAuthz restores the default.
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
    owner: BOARD_AUTHOR,
    scope: "team",
    team_id: TEST_TEAM_ID,
    title: board.title,
    description: board.description,
    mode: board.mode,
    markers: board.markers,
    steps: board.steps,
    tags: board.tags,
    topic_id: board.topicId,
    shared: false,
    author_locked: false,
    auto_arrows: true,
    rotation_strict: false,
    share_token: `token-${board.id}`,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    deleted_by: null,
  };
}

function toTopicRow(topic: Topic): TopicRow {
  return {
    id: topic.id,
    owner: TEST_USER.id,
    scope: "team",
    team_id: TEST_TEAM_ID,
    title: topic.title,
    slug: topic.slug,
    blocks: topic.blocks,
    parent_id: topic.parentId,
    sort_order: topic.order,
    created_at: ISO,
    updated_at: ISO,
    deleted_at: null,
    deleted_by: null,
  };
}

// One board in the test user's personal space, so navigating there shows a distinct library.
const PERSONAL_BOARD: BoardRow = {
  id: "personal-board-1",
  owner: TEST_USER.id,
  scope: "personal",
  team_id: null,
  title: "My Personal Position",
  description: "",
  mode: "positions",
  markers: [],
  steps: [{ id: "personal-step-1", instruction: "", positions: {} }],
  tags: [],
  topic_id: null,
  shared: false,
  author_locked: false,
  auto_arrows: true,
  rotation_strict: false,
  share_token: "token-personal-1",
  created_at: ISO,
  updated_at: ISO,
  deleted_at: null,
  deleted_by: null,
};

// Another user's personal board, shared into the test team. It belongs to neither the team list nor the
// test user's personal list, so it is only reachable through its share token — what a share link does.
const SHARED_PERSONAL: BoardRow = {
  ...PERSONAL_BOARD,
  id: "shared-board-1",
  owner: BOARD_AUTHOR,
  team_id: TEST_TEAM_ID,
  title: "Shared Tactic",
  shared: true,
  share_token: "token-shared-1",
};

// One board in the showcase team, so the read-only Inspiration space shows a distinct library.
const SHOWCASE_BOARD: BoardRow = {
  ...PERSONAL_BOARD,
  id: "showcase-board-1",
  owner: BOARD_AUTHOR,
  scope: "team",
  team_id: SHOWCASE_TEAM_ID,
  title: "Inspiration Example",
  share_token: "token-showcase-1",
};

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;
type DbResult = { data: unknown; error: { message: string; code?: string } | null };

const ok = (data: unknown): DbResult => ({ data, error: null });

// Writes, RPCs, and Edge Function calls are recorded so a test can assert the data layer issues the right
// call (a soft-delete update, a soft_delete_topic RPC, a delete-account invoke). Reset between tests.
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

// The next `count` table writes fail with `message` (and an optional Postgres error `code`), so a test
// can exercise the commit path's retry and failure handling. Reset (to zero) by resetRecorded.
let failingWrites = 0;
let failingMessage = "Load failed";
let failingCode: string | undefined;

export function failWrites(count: number, message = "Load failed", code?: string): void {
  failingWrites = count;
  failingMessage = message;
  failingCode = code;
}

export function resetRecorded(): void {
  recordedWrites.length = 0;
  recordedRpcs.length = 0;
  recordedInvokes.length = 0;
  failingWrites = 0;
  failingCode = undefined;
}

// A chainable query stub. Filter methods record a predicate and return the same object; awaiting it (or
// calling single) resolves the seeded rows that match every filter for a read, or an empty success for a
// write. `created` is the row a write's insert(...).select().single() resolves to (a new id). `.is` treats
// null and an absent column as equal; `.not(col, "is", null)` matches rows whose column is set.
type Query = {
  select: () => Query;
  insert: (payload?: Row) => Query;
  update: (payload?: Row) => Query;
  delete: () => Query;
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: readonly unknown[]) => Query;
  is: (column: string, value: unknown) => Query;
  not: (column: string, op: string, value: unknown) => Query;
  single: () => Promise<DbResult>;
  maybeSingle: () => Promise<DbResult>;
  then: (onfulfilled: (value: DbResult) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(table: string, rows: Row[], created: Row | null): Query {
  let write = false;
  let record: WriteCall | null = null;
  const filters: Predicate[] = [];
  const matches = () => rows.filter((row) => filters.every((f) => f(row)));

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
      filters.push((row) => row[column] === value);
      if (record) record.eq[column] = value;

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

// A second team member (a player who is not the test user), so member removal can target someone else, and
// a grace-archived board and topic, so the deleted_at filter and the admin recovery list can be exercised.
export const OTHER_MEMBER = { id: "player-2", email: "player@volley.test" };

const DELETED_BOARD: BoardRow = {
  ...PERSONAL_BOARD,
  id: "deleted-board-1",
  owner: BOARD_AUTHOR,
  scope: "team",
  team_id: TEST_TEAM_ID,
  title: "Archived Board",
  share_token: "token-deleted-1",
  deleted_at: ISO,
  deleted_by: TEST_USER.id,
};

const DELETED_TOPIC: TopicRow = {
  ...toTopicRow(SAMPLE_TOPICS[0]),
  id: "deleted-topic-1",
  title: "Archived Topic",
  deleted_at: ISO,
  deleted_by: TEST_USER.id,
};

// A soft-deleted account and a soft-deleted team, so the admin recovery list (and the restore actions) can
// be exercised. Neither is a member of, or owned by, the test user, so they only surface in the admin panel.
export const DELETED_ACCOUNT = { id: "gone-1", email: "gone@volley.test" };
export const DELETED_TEAM = { id: "old-team-1", name: "Old Team" };

function from(table: string): Query {
  switch (table) {
    case "boards":
      return makeQuery(table, [...SAMPLE_BOARDS.map(toBoardRow), PERSONAL_BOARD, SHOWCASE_BOARD, DELETED_BOARD], null);
    case "topics":
      return makeQuery(table, [...SAMPLE_TOPICS.map(toTopicRow), DELETED_TOPIC], null);
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
    case "profiles":
      return makeQuery(
        table,
        [
          {
            id: TEST_USER.id,
            email: TEST_USER.email,
            is_admin: authz.isAdmin,
            display_name: authz.displayName,
            deleted_at: null,
          },
          {
            id: OTHER_MEMBER.id,
            email: OTHER_MEMBER.email,
            is_admin: false,
            display_name: "Player Pat",
            deleted_at: null,
          },
          {
            id: DELETED_ACCOUNT.id,
            email: DELETED_ACCOUNT.email,
            is_admin: false,
            display_name: null,
            deleted_at: ISO,
          },
        ],
        null
      );
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

// Inviting and account deletion go through Edge Functions; the fake records the call and accepts it so the
// client wiring can be tested without a deployed function.
const functions = {
  invoke: (name: string, opts?: { body?: unknown }) => {
    recordedInvokes.push({ name, body: opts?.body });

    return Promise.resolve({ data: { ok: true }, error: null });
  },
};

// The share-token resolver, mirroring the public board_by_token function: it returns one board for an
// exact token, but only a team board or a shared personal board (an unshared personal board never
// resolves), so a link visitor sees exactly what the database would expose.
function rpc(fn: string, params: { token?: string }): Promise<DbResult> {
  recordedRpcs.push({ fn, params });

  // The soft-delete and team-delete RPCs run server-side; the fake accepts them so the client wiring can
  // be tested without the database.
  if (fn === "soft_delete_topic" || fn === "delete_team") return Promise.resolve(ok(null));

  if (fn !== "board_by_token") return Promise.resolve({ data: null, error: { message: `unknown rpc ${fn}` } });

  const all = [...SAMPLE_BOARDS.map(toBoardRow), PERSONAL_BOARD, SHARED_PERSONAL];
  const row = all.find(
    (b) => b.share_token === params.token && (b.scope === "team" || (b.scope === "personal" && b.shared))
  );

  return Promise.resolve(ok(row ? [row] : []));
}

export const supabaseFake = { auth, from, functions, rpc };
