import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { RosterSection } from "../../src/team/RosterSection";

// The roster runs against a mocked Supabase client (its one external dependency): the read returns the
// seeded rows, and every write is recorded and answers with the error set per test.
type Row = Record<string, unknown>;

const writes: { op: string; payload?: Row | Row[] }[] = [];
let writeError: { message: string; code?: string } | null = null;

const ROWS: Row[] = [
  {
    id: "r1",
    team_id: "t1",
    number: 7,
    name: "Ana",
    main_position: "setter",
    secondary_position: null,
    archived_at: null,
  },
  {
    id: "r2",
    team_id: "t1",
    number: 3,
    name: "Bea",
    main_position: "outside",
    secondary_position: "opposite",
    archived_at: null,
  },
  {
    id: "r3",
    team_id: "t1",
    number: 9,
    name: "Gone",
    main_position: "middle",
    secondary_position: null,
    archived_at: "2026-01-01",
  },
];

vi.mock("../../src/supabase/client", () => {
  const query = (op: string, payload?: Row | Row[]) => {
    const q: Record<string, unknown> = {};

    q.eq = () => q;
    q.select = () => q;
    q.then = (onfulfilled: (value: unknown) => unknown) => {
      if (op !== "select") writes.push({ op, payload });

      return Promise.resolve(op === "select" ? { data: ROWS, error: null } : { data: null, error: writeError }).then(
        onfulfilled
      );
    };

    return q;
  };

  return {
    supabase: {
      from: () => ({
        select: () => query("select"),
        insert: (payload: Row | Row[]) => query("insert", payload),
        update: (payload: Row) => query("update", payload),
      }),
    },
  };
});

beforeEach(() => {
  writes.length = 0;
  writeError = null;
});

describe("RosterSection", () => {
  test("lists the active players by number, without the archived ones", async () => {
    render(<RosterSection teamId="t1" teamName="Eagles" canManage={false} />);

    const rows = await screen.findAllByRole("row");

    expect(rows.slice(1).map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual(["Bea", "Ana"]);
    expect(screen.queryByRole("button", { name: "Add player" })).not.toBeInTheDocument();
  });

  test("a coach adds a player", async () => {
    render(<RosterSection teamId="t1" teamName="Eagles" canManage />);

    await userEvent.click(await screen.findByRole("button", { name: "Add player" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Number" }), "12");
    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), "Cleo");
    await userEvent.click(screen.getByRole("button", { name: "Save player" }));

    expect(await screen.findByRole("cell", { name: "Cleo" })).toBeInTheDocument();
    expect(writes[0]).toMatchObject({
      op: "insert",
      payload: [{ number: 12, name: "Cleo", main_position: "outside" }],
    });
  });

  test("a taken number keeps the dialog open with the reason", async () => {
    writeError = { message: "duplicate key", code: "23505" };
    render(<RosterSection teamId="t1" teamName="Eagles" canManage />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit #7" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Number" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Number" }), "3");
    await userEvent.click(screen.getByRole("button", { name: "Save player" }));

    expect(await screen.findByText("Another player already wears that number.")).toBeInTheDocument();
  });

  test("a coach removes a player by archiving them", async () => {
    render(<RosterSection teamId="t1" teamName="Eagles" canManage />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove #7" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByRole("cell", { name: "Ana" })).not.toBeInTheDocument());
    expect(writes[0].payload).toHaveProperty("archived_at");
  });

  test("a coach imports players, skipping lines that cannot be added", async () => {
    render(<RosterSection teamId="t1" teamName="Eagles" canManage />);

    await userEvent.click(await screen.findByRole("button", { name: "Import…" }));
    await userEvent.click(screen.getByRole("textbox", { name: "Players" }));
    await userEvent.paste("number,name,main\n12,Cleo,OH\n7,Dup,S");

    expect(screen.getByText("#7 is already taken")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add 1 player" }));

    expect(await screen.findByRole("cell", { name: "Cleo" })).toBeInTheDocument();
    expect(writes[0].payload).toEqual([
      expect.objectContaining({ number: 12, name: "Cleo", main_position: "outside" }),
    ]);
  });
});
