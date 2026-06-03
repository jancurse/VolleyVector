import { describe, expect, test } from "vitest";

import type { MarkerRole } from "../../src/court/roles";
import type { Marker } from "../../src/court/types";
import { createTactic, makeMarker, nextLabel, removeMarker, setMarker } from "../../src/tactics/operations";

const MARKERS: Marker[] = [
  { id: "a", role: "outside", label: "OH1", position: { x: 0.2, y: 0.2 } },
  { id: "b", role: "setter", label: "S", position: { x: 0.5, y: 0.5 } },
];

describe("nextLabel", () => {
  test.each<[MarkerRole, string]>([
    ["outside", "OH2"], // numbered role, one already present
    ["middle", "MB1"], // numbered role, first of its kind
    ["setter", "S2"], // singular role, but a second copy is numbered
    ["libero", "L"], // singular role, first of its kind stays bare
  ])("labels a new %s as %s", (role, expected) => {
    expect(nextLabel(role, MARKERS)).toBe(expected);
  });

  test("leaves the ball unlabelled", () => {
    expect(nextLabel("ball", MARKERS)).toBeUndefined();
  });
});

describe("makeMarker", () => {
  test("builds a labelled marker on the bench below the court", () => {
    const marker = makeMarker("middle", MARKERS);

    expect(marker).toMatchObject({ role: "middle", label: "MB1" });
    expect(marker.position.y).toBeGreaterThan(1); // on the bench, below the end line
  });

  test("fills the leftmost free bench slot, reusing slots vacated onto the court", () => {
    const first = makeMarker("player", []);
    const second = makeMarker("player", [first]);

    expect(second.position.x).toBeGreaterThan(first.position.x);

    // Once `first` is dragged onto the court (y < 1) its bench slot frees up again.
    const onCourt = { ...first, position: { x: 0.5, y: 0.5 } };

    expect(makeMarker("player", [onCourt]).position.x).toBe(first.position.x);
  });

  test("gives each new marker a distinct id", () => {
    expect(makeMarker("setter", MARKERS).id).not.toBe(makeMarker("setter", MARKERS).id);
  });
});

describe("setMarker", () => {
  test("patches only the matching marker without mutating the input", () => {
    const result = setMarker(MARKERS, "b", { role: "libero" });

    expect(result.find((m) => m.id === "b")?.role).toBe("libero");
    expect(result.find((m) => m.id === "a")?.role).toBe("outside");
    expect(MARKERS.find((m) => m.id === "b")?.role).toBe("setter");
  });
});

describe("removeMarker", () => {
  test("drops only the matching marker", () => {
    expect(removeMarker(MARKERS, "a").map((m) => m.id)).toEqual(["b"]);
  });
});

describe("createTactic", () => {
  test("starts empty in the given mode and stamps the time", () => {
    const tactic = createTactic(1234, "basic", "Press");

    expect(tactic).toMatchObject({ title: "Press", mode: "basic", markers: [], createdAt: 1234, updatedAt: 1234 });
    expect(tactic.id).not.toHaveLength(0);
  });

  test("defaults to positions mode", () => {
    expect(createTactic(0).mode).toBe("positions");
  });
});
