import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Court } from "../../src/court/Court";
import type { Marker } from "../../src/court/types";

const MARKERS: Marker[] = [
  { id: "s", role: "setter", label: "S", position: { x: 0.5, y: 0.5 } },
  { id: "mb", role: "middle", label: "MB", position: { x: 0.3, y: 0.3 } },
  { id: "oh1", role: "outside", label: "OH1", position: { x: 0.7, y: 0.2 } },
  { id: "ball", role: "ball", position: { x: 0.5, y: 0.05 } },
];

describe("Court", () => {
  test.each(["S", "MB", "OH1"])("renders the %s marker label", (label) => {
    render(<Court markers={MARKERS} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  test.each(["Setter", "Middle blocker", "Outside hitter 1", "Ball"])("names the %s marker accessibly", (name) => {
    render(<Court markers={MARKERS} />);
    expect(screen.getByLabelText(name)).toBeInTheDocument();
  });

  test("uses the given diagram label as its accessible name", () => {
    render(<Court markers={MARKERS} label="Base defence" />);
    expect(screen.getByLabelText("Base defence")).toBeInTheDocument();
  });

  test("defaults the diagram label when none is given", () => {
    render(<Court markers={MARKERS} />);
    expect(screen.getByLabelText("Volleyball half-court")).toBeInTheDocument();
  });
});
