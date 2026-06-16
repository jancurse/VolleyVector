import { describe, expect, it } from "vitest";

import { breadcrumbs, collapseCrumbs } from "../../src/shell/breadcrumb";
import type { Crumb } from "../../src/shell/breadcrumb";
import type { Board } from "../../src/boards/types";
import type { Route } from "../../src/routing/route";
import type { Note } from "../../src/notes/types";
import type { TeamMembership } from "../../src/workspace/useWorkspace";

const teams: TeamMembership[] = [{ teamId: "team-1", teamName: "Falcons", slug: "falcons", role: "coach" }];

// A three-level chain: Attack > Tempo > Quick.
function note(id: string, parentId: string | null, title: string): Note {
  return { id, parentId, title, slug: id, blocks: [], order: 0, capability: "owner", currentRevisionId: null };
}

const base: Note[] = [
  note("t-attack", null, "Attack"),
  note("t-tempo", "t-attack", "Tempo"),
  note("t-quick", "t-tempo", "Quick"),
];

const teamSpace = { kind: "team", teamSlug: "team-1" } as const;

describe("breadcrumbs", () => {
  it("shows the space alone for a library route", () => {
    const route: Route = { kind: "library", space: teamSpace };

    expect(breadcrumbs(route, teams, base, []).map((c) => c.label)).toEqual(["Falcons"]);
  });

  it("walks the live note ancestor chain, root first", () => {
    const route: Route = { kind: "note", space: teamSpace, noteSlug: "t-quick" };

    expect(breadcrumbs(route, teams, base, []).map((c) => c.label)).toEqual(["Falcons", "Attack", "Tempo", "Quick"]);
  });

  it("re-derives the chain after a re-nest, since the path is never encoded", () => {
    // Re-nest Quick directly under Attack (Tempo drops out of its chain).
    const renested = base.map((t) => (t.id === "t-quick" ? { ...t, parentId: "t-attack" } : t));
    const route: Route = { kind: "note", space: teamSpace, noteSlug: "t-quick" };

    expect(breadcrumbs(route, teams, renested, []).map((c) => c.label)).toEqual(["Falcons", "Attack", "Quick"]);
  });

  it("ends a board route with the board title under the space alone (a board has no home note)", () => {
    const board = { id: "b-1", title: "Quick set" } as Board;
    const route: Route = { kind: "board", space: teamSpace, boardId: "b-1", edit: false };

    expect(breadcrumbs(route, teams, base, [board]).map((c) => c.label)).toEqual(["Falcons", "Quick set"]);
  });

  it("trails a team's management page under its library", () => {
    expect(breadcrumbs({ kind: "team", teamSlug: "team-1" }, teams, base, []).map((c) => c.label)).toEqual([
      "Falcons",
      "Members",
    ]);
  });

  it("labels the admin and settings routes", () => {
    expect(breadcrumbs({ kind: "admin", sub: "recovery" }, teams, base, []).map((c) => c.label)).toEqual([
      "Admin",
      "Recovery",
    ]);
    expect(breadcrumbs({ kind: "settings" }, teams, base, []).map((c) => c.label)).toEqual(["Account"]);
  });
});

describe("collapseCrumbs", () => {
  const crumb = (label: string): Crumb => ({ label, route: { kind: "settings" } });

  it("renders a trail of up to four crumbs in full", () => {
    const items = collapseCrumbs(["Falcons", "Attack", "Tempo", "Quick"].map(crumb));

    expect(items.map((i) => i.kind)).toEqual(["crumb", "crumb", "crumb", "crumb"]);
  });

  it("folds a long trail's middle behind one ellipsis, keeping the head and the last two", () => {
    const items = collapseCrumbs(["Falcons", "Attack", "Tempo", "Quick", "Slide", "Quick set"].map(crumb));

    expect(items.map((i) => (i.kind === "crumb" ? i.crumb.label : "…"))).toEqual([
      "Falcons",
      "…",
      "Slide",
      "Quick set",
    ]);
    expect(items[1].kind === "collapsed" && items[1].hidden.map((c) => c.label)).toEqual(["Attack", "Tempo", "Quick"]);
  });
});
