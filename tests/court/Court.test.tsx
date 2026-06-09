import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { Court } from "../../src/court/Court";
import type { Annotation, Marker } from "../../src/court/types";

const MARKERS: Marker[] = [
  { id: "s", role: "setter", label: "S", position: { x: 0.5, y: 0.5 } },
  { id: "mb", role: "middle", label: "MB", position: { x: 0.3, y: 0.3 } },
  { id: "oh1", role: "outside", label: "OH1", position: { x: 0.7, y: 0.2 } },
  { id: "ball", role: "ball", position: { x: 0.5, y: 0.05 } },
];

// One of every annotation kind, so rendering exercises each shape branch — including the freehand path
// built through perfect-freehand.
const ANNOTATIONS: Annotation[] = [
  { id: "l", kind: "line", a: { x: 0.1, y: 0.1 }, b: { x: 0.5, y: 0.5 }, color: "red", width: 8 },
  { id: "a", kind: "arrow", from: { x: 0.2, y: 0.2 }, to: { x: 0.8, y: 0.8 }, color: "blue", width: 8 },
  { id: "r", kind: "rect", a: { x: 0.2, y: 0.2 }, b: { x: 0.6, y: 0.5 }, color: "green", width: 8 },
  { id: "e", kind: "area", a: { x: 0.3, y: 0.3 }, b: { x: 0.7, y: 0.6 }, color: "amber", width: 8 },
  {
    id: "f",
    kind: "free",
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.15 },
      { x: 0.3, y: 0.1 },
    ],
    color: "violet",
    width: 8,
  },
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

  test("renders every annotation kind alongside the markers", () => {
    const { container } = render(<Court markers={MARKERS} annotations={ANNOTATIONS} label="Annotated" />);

    expect(screen.getByLabelText("Annotated")).toBeInTheDocument();
    // Each annotation renders one themed group; the markers still render too.
    expect(container.querySelectorAll(".court-annotation")).toHaveLength(ANNOTATIONS.length);
    expect(screen.getByLabelText("Setter")).toBeInTheDocument();
  });
});
