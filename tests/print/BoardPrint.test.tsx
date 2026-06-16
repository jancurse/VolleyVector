import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { Board, BoardStep } from "../../src/boards/types";
import { BoardPrint } from "../../src/print/BoardPrint";

function board(steps: BoardStep[]): Board {
  return {
    id: "b",
    title: "Rotation 1",
    description: "Base alignment",
    mode: "positions",
    markers: [{ id: "m", role: "setter", label: "S" }],
    steps,
    tags: [],
    createdBy: null,
    capability: "owner",
    currentRevisionId: null,
    autoArrows: true,
    rotationStrict: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const step = (id: string, instruction: string): BoardStep => ({
  id,
  instruction,
  positions: { m: { x: 0.5, y: 0.5 } },
});

describe("BoardPrint", () => {
  test("prints a Position as one court with its title and description", () => {
    render(<BoardPrint board={board([step("s1", "")])} />);

    expect(screen.getByRole("heading", { name: "Rotation 1", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Base alignment")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotation 1")).toBeInTheDocument();
    expect(screen.queryByText("Step 1")).not.toBeInTheDocument();
  });

  test("prints a Sequence as one captioned court per step with its instruction", () => {
    render(<BoardPrint board={board([step("s1", "Serve"), step("s2", "Switch")])} />);

    expect(screen.getByText("Sequence · 2 steps")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotation 1 — step 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Rotation 1 — step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Serve")).toBeInTheDocument();
    expect(screen.getByText("Switch")).toBeInTheDocument();
  });
});
