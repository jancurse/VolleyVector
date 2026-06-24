import { describe, expect, test } from "vitest";

import type { Board } from "../../src/boards/types";
import { boardFromRevision } from "../../src/supabase/rows";
import type { BoardRevisionRow } from "../../src/supabase/rows";

const BOARD: Board = {
  id: "b",
  title: "Live",
  description: "",
  mode: "positions",
  markers: [],
  steps: [{ id: "s1", instruction: "", positions: {} }],
  tags: [],
  createdBy: "u",
  capability: "owner",
  currentRevisionId: "rev1",
  autoArrows: true,
  rotationStrict: false,
  createdAt: 1000,
  updatedAt: 2000,
};

function revision(content: Record<string, unknown>): BoardRevisionRow {
  return {
    id: "rev0",
    board_id: "b",
    content,
    created_by: "u",
    base_revision_id: null,
    created_at: "1970-01-01T00:00:01.000Z",
  };
}

describe("boardFromRevision", () => {
  test("defaults auto_arrows to true when the snapshot omits it, matching the live read path", () => {
    expect(boardFromRevision(revision({ title: "Old" }), BOARD).autoArrows).toBe(true);
  });

  test("honours an explicit auto_arrows in the snapshot", () => {
    expect(boardFromRevision(revision({ auto_arrows: false }), BOARD).autoArrows).toBe(false);
    expect(boardFromRevision(revision({ auto_arrows: true }), BOARD).autoArrows).toBe(true);
  });
});
