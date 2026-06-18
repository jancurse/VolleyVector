import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { Court } from "../../src/court/Court";
import { toSvg } from "../../src/court/geometry";
import { ROLES } from "../../src/court/roles";
import type { Annotation, Marker } from "../../src/court/types";

const MARKERS: Marker[] = [
  { id: "s", role: "setter", label: "S", position: { x: 0.5, y: 0.5 } },
  { id: "mb", role: "middle", label: "MB", position: { x: 0.3, y: 0.3 } },
  { id: "oh1", role: "outside", label: "OH1", position: { x: 0.7, y: 0.2 } },
  { id: "ball", role: "ball", position: { x: 0.5, y: 0.05 } },
];

// One of every annotation kind, so rendering exercises each shape branch — including the selectively
// smoothed freehand path, a dashed stroke, and an arrow bent through `via`.
const ANNOTATIONS: Annotation[] = [
  { id: "l", kind: "line", a: { x: 0.1, y: 0.1 }, b: { x: 0.5, y: 0.5 }, dash: "dashed", color: "red", width: 8 },
  {
    id: "a",
    kind: "arrow",
    from: { x: 0.2, y: 0.2 },
    to: { x: 0.8, y: 0.8 },
    via: { x: 0.7, y: 0.3 },
    dash: "dashed",
    color: "blue",
    width: 8,
  },
  { id: "r", kind: "rect", a: { x: 0.2, y: 0.2 }, b: { x: 0.6, y: 0.5 }, fill: "none", color: "green", width: 8 },
  { id: "e", kind: "ellipse", a: { x: 0.3, y: 0.3 }, b: { x: 0.7, y: 0.6 }, fill: "tint", color: "amber", width: 8 },
  {
    id: "z",
    kind: "polygon",
    points: [
      { x: 0.1, y: 0.6 },
      { x: 0.4, y: 0.6 },
      { x: 0.25, y: 0.9 },
    ],
    fill: "hachure",
    color: "green",
    width: 8,
  },
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
  { id: "t", kind: "text", at: { x: 0.5, y: 0.7 }, text: "Serve", color: "red", width: 8 },
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

  test.each([
    ["select", "r", 4], // a selected rect under the select tool shows its four corner handles
    ["select", "a", 3], // a selected arrow shows its endpoint handles plus the bend handle
    ["select", "z", 3], // a selected polygon shows one handle per vertex
    ["markers", "r", 0], // no handles outside the select tool
    ["select", null, 0], // or with nothing selected
  ] as const)("under the %s tool with %s selected renders %i reshape handles", (tool, selectedId, count) => {
    const { container } = render(
      <Court
        markers={MARKERS}
        annotations={ANNOTATIONS}
        tool={tool}
        selectedAnnotationId={selectedId}
        onDrawAnnotation={() => {}}
        onReshapeAnnotation={() => {}}
      />
    );

    expect(container.querySelectorAll(".court-annotation-handle")).toHaveLength(count);
  });

  test.each([
    ["full size", undefined, true],
    ["compact", true, false],
  ] as const)("at %s the marker labels are present: %s", (_name, compact, present) => {
    render(<Court markers={MARKERS} compact={compact} />);
    expect(screen.queryByText("S") !== null).toBe(present);
    // The markers themselves still render either way (named accessibly, label or not).
    expect(screen.getByLabelText("Setter")).toBeInTheDocument();
  });

  test("draws the ball's movement arrow dashed and a player's solid", () => {
    const arrows = [
      { from: { x: 0.2, y: 0.2 }, to: { x: 0.8, y: 0.8 }, color: "var(--ball-arrow)", dashed: true },
      { from: { x: 0.2, y: 0.8 }, to: { x: 0.8, y: 0.2 }, color: ROLES.outside.fill, dashed: false },
    ];
    const { container } = render(<Court markers={MARKERS} arrows={arrows} />);

    expect(container.querySelectorAll(".court-arrow-line")).toHaveLength(2);
    expect(container.querySelectorAll(".court-arrow-line--dashed")).toHaveLength(1);
  });

  test("renders every annotation kind alongside the markers", () => {
    const { container } = render(<Court markers={MARKERS} annotations={ANNOTATIONS} label="Annotated" />);

    expect(screen.getByLabelText("Annotated")).toBeInTheDocument();
    // Each annotation renders one themed group; the markers still render too.
    expect(container.querySelectorAll(".court-annotation")).toHaveLength(ANNOTATIONS.length);
    expect(screen.getByText("Serve")).toBeInTheDocument(); // the text label renders its content
    expect(container.querySelectorAll(".court-annotation-hachure")).toHaveLength(1); // the hachure zone
    // The dashed line scales its dash to its width; the bent (dashed) arrow draws a quadratic curve.
    expect(container.querySelector('line[stroke-dasharray="19.2 17.6"]')).not.toBeNull();
    expect(container.querySelector('path[stroke-dasharray="19.2 17.6"][d*="Q"]')).not.toBeNull();
    expect(screen.getByLabelText("Setter")).toBeInTheDocument();
  });
});

// The polygon's multi-click gesture, exercised through the court surface. happy-dom maps client
// coordinates straight onto SVG units (an identity CTM), so `toSvg` gives each click's position.
describe("Court polygon drawing", () => {
  function setup() {
    const onDraw = vi.fn();

    render(
      <Court
        markers={[]}
        tool="polygon"
        annotationStyle={{ color: "red", width: 8, fill: "hachure", dash: "solid" }}
        onDrawAnnotation={onDraw}
      />
    );

    return { onDraw, svg: screen.getByLabelText("Volleyball half-court") };
  }

  function click(svg: Element, x: number, y: number): void {
    fireEvent.pointerDown(svg, { clientX: toSvg(x), clientY: toSvg(y), pointerId: 1 });
    fireEvent.pointerUp(svg, { pointerId: 1 });
  }

  test("clicked vertices close into the drawn polygon via the first vertex", () => {
    const { onDraw, svg } = setup();

    click(svg, 0.2, 0.2);
    click(svg, 0.8, 0.2);
    click(svg, 0.5, 0.8);
    click(svg, 0.21, 0.21); // within the close radius of the first vertex

    expect(onDraw).toHaveBeenCalledTimes(1);

    const drawn = onDraw.mock.calls[0][0];

    expect(drawn.kind).toBe("polygon");
    expect(drawn.fill).toBe("hachure");
    expect(drawn.points).toHaveLength(3);
    expect(drawn.points[1].x).toBeCloseTo(0.8);
  });

  test("clicking the last placed vertex closes the polygon (the double-click path)", () => {
    const { onDraw, svg } = setup();

    click(svg, 0.2, 0.2);
    click(svg, 0.8, 0.2);
    click(svg, 0.5, 0.8);
    click(svg, 0.51, 0.81); // within the close radius of the last vertex

    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onDraw.mock.calls[0][0].points).toHaveLength(3);
  });

  test("shows close-target dots on the first and last vertex, warming in closing range", () => {
    const { svg } = setup();

    click(svg, 0.2, 0.2);
    expect(document.querySelectorAll(".court-poly-target")).toHaveLength(1);

    click(svg, 0.8, 0.2);
    click(svg, 0.5, 0.8);
    expect(document.querySelectorAll(".court-poly-target")).toHaveLength(2);

    // Away from both targets nothing is hot; entering the first vertex's range lights its dot.
    fireEvent.pointerMove(svg, { clientX: toSvg(0.5), clientY: toSvg(0.5), pointerId: 1 });
    expect(document.querySelector(".court-poly-target--hot")).toBeNull();

    fireEvent.pointerMove(svg, { clientX: toSvg(0.21), clientY: toSvg(0.21), pointerId: 1 });
    expect(document.querySelectorAll(".court-poly-target--hot")).toHaveLength(1);
  });

  test("Enter closes the polygon on its placed vertices", async () => {
    const user = userEvent.setup();
    const { onDraw, svg } = setup();

    click(svg, 0.2, 0.2);
    click(svg, 0.8, 0.2);
    click(svg, 0.5, 0.8);
    await user.keyboard("{Enter}");

    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onDraw.mock.calls[0][0].points).toHaveLength(3);
  });

  test.each([
    ["{Escape}", 3], // Escape cancels outright, however many vertices exist
    ["{Enter}", 2], // closing with fewer than 3 vertices discards
  ])("pressing %s after %i vertices draws nothing", async (key, vertices) => {
    const user = userEvent.setup();
    const { onDraw, svg } = setup();
    const points: [number, number][] = [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.5, 0.8],
    ];

    points.slice(0, vertices).forEach(([x, y]) => click(svg, x, y));
    await user.keyboard(key);

    expect(onDraw).not.toHaveBeenCalled();
    // The rubber-band draft is gone too.
    expect(document.querySelector(".court-annotation--draft")).toBeNull();
  });
});
