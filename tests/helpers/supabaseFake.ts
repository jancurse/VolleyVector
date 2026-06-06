import { SAMPLE_BOARDS } from "../../src/boards/storage";
import type { Board } from "../../src/boards/types";
import type { BoardRow, TopicRow } from "../../src/supabase/rows";
import { SAMPLE_TOPICS } from "../../src/topics/storage";
import type { Topic } from "../../src/topics/types";

// A tiny in-memory stand-in for the Supabase client, used to test surfaces that read through the data
// layer. It mocks only the external dependency (per the style guide), so the real stores, hooks, and
// components run against it. It seeds the same sample boards and topics the app ships with, and treats
// every write as an accepted no-op: the stores apply edits optimistically, so the UI reflects them
// without the fake having to persist. Access control is not modelled here — that is the database's job
// and is exercised against the real database, not this fake.

export const TEST_TEAM_ID = "test-team";
export const TEST_USER = { id: "test-user", email: "coach@volley.test" };

// Seed boards are authored by someone other than the test user, so ownership-based rules (the author
// lock, read-only for non-authors) can be exercised distinctly from the admin god-mode.
const BOARD_AUTHOR = "seed-coach";

const ISO = "2026-01-01T00:00:00.000Z";

// The test user's standing in the active team. Defaults to an admin coach (full access); a test can
// lower it to exercise read-only and per-role gating, and resetFakeAuthz restores the default.
type Authz = { isAdmin: boolean; role: "coach" | "player" };

const authz: Authz = { isAdmin: true, role: "coach" };

export function setFakeAuthz(next: Partial<Authz>): void {
  Object.assign(authz, next);
}

export function resetFakeAuthz(): void {
  authz.isAdmin = true;
  authz.role = "coach";
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
    share_token: `token-${board.id}`,
    created_at: ISO,
    updated_at: ISO,
  };
}

function toTopicRow(topic: Topic): TopicRow {
  return {
    id: topic.id,
    owner: TEST_USER.id,
    scope: "team",
    team_id: TEST_TEAM_ID,
    title: topic.title,
    blocks: topic.blocks,
    parent_id: topic.parentId,
    sort_order: topic.order,
    created_at: ISO,
    updated_at: ISO,
  };
}

type DbResult = { data: unknown; error: { message: string } | null };

const ok = (data: unknown): DbResult => ({ data, error: null });

// A chainable query stub. The filter methods return the same object; awaiting it (or calling single)
// resolves the seeded rows for a read, or an empty success for a write.
type Query = {
  select: () => Query;
  insert: () => Query;
  update: () => Query;
  delete: () => Query;
  eq: () => Query;
  in: () => Query;
  single: () => Promise<DbResult>;
  then: (onfulfilled: (value: DbResult) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

function makeQuery(rows: unknown, one: unknown): Query {
  let write = false;

  const query: Query = {
    select: () => query,
    insert: () => {
      write = true;

      return query;
    },
    update: () => {
      write = true;

      return query;
    },
    delete: () => {
      write = true;

      return query;
    },
    eq: () => query,
    in: () => query,
    single: () => Promise.resolve(ok(one)),
    then: (onfulfilled, onrejected) => Promise.resolve(write ? ok(null) : ok(rows)).then(onfulfilled, onrejected),
  };

  return query;
}

function from(table: string): Query {
  switch (table) {
    case "boards":
      return makeQuery(SAMPLE_BOARDS.map(toBoardRow), null);
    case "topics":
      return makeQuery(SAMPLE_TOPICS.map(toTopicRow), null);
    case "memberships":
      return makeQuery([{ team_id: TEST_TEAM_ID, user_id: TEST_USER.id, role: authz.role }], null);
    case "teams":
      return makeQuery([{ id: TEST_TEAM_ID, name: "My Team" }], { id: "new-team" });
    case "profiles":
      return makeQuery([{ id: TEST_USER.id, email: TEST_USER.email }], { is_admin: authz.isAdmin });
    default:
      return makeQuery([], null);
  }
}

const session = { user: TEST_USER };

const auth = {
  getSession: () => Promise.resolve({ data: { session }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signInWithPassword: () => Promise.resolve({ data: { session }, error: null }),
  signOut: () => Promise.resolve({ error: null }),
};

// Inviting goes through an Edge Function; the fake accepts every invite so the client wiring can be
// tested without the deployed function.
const functions = {
  invoke: () => Promise.resolve({ data: { ok: true }, error: null }),
};

export const supabaseFake = { auth, from, functions };
