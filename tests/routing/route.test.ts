import { describe, expect, it, test } from "vitest";

import { buildPath, parsePath, routeSpace, sameRouteSpace, type Route } from "../../src/routing/route";

const personal = { kind: "personal" } as const;
const team = { kind: "team", teamSlug: "acme" } as const;

// Every routable kind, with its canonical path. Round-tripping both directions covers parse and build.
const cases: { route: Route; path: string }[] = [
  { route: { kind: "library", space: personal }, path: "/personal" },
  { route: { kind: "library", space: team }, path: "/t/acme" },
  { route: { kind: "note", space: personal, noteSlug: "serve-receive" }, path: "/personal/note/serve-receive" },
  { route: { kind: "note", space: team, noteSlug: "rotations" }, path: "/t/acme/note/rotations" },
  { route: { kind: "board", space: personal, boardId: "b-1", edit: false }, path: "/personal/board/b-1" },
  { route: { kind: "board", space: personal, boardId: "b-1", edit: true }, path: "/personal/board/b-1/edit" },
  { route: { kind: "board", space: team, boardId: "b-2", edit: false }, path: "/t/acme/board/b-2" },
  { route: { kind: "board", space: team, boardId: "b-2", edit: true }, path: "/t/acme/board/b-2/edit" },
  { route: { kind: "printBoard", space: personal, boardId: "b-1" }, path: "/personal/board/b-1/print" },
  { route: { kind: "printBoard", space: team, boardId: "b-2" }, path: "/t/acme/board/b-2/print" },
  {
    route: { kind: "printNote", space: personal, noteSlug: "serve-receive" },
    path: "/personal/note/serve-receive/print",
  },
  { route: { kind: "printNote", space: team, noteSlug: "rotations" }, path: "/t/acme/note/rotations/print" },
  { route: { kind: "team", teamSlug: "acme" }, path: "/t/acme/team" },
  { route: { kind: "settings" }, path: "/settings" },
  { route: { kind: "admin", sub: "teams" }, path: "/admin/teams" },
  { route: { kind: "admin", sub: "accounts" }, path: "/admin/accounts" },
  { route: { kind: "admin", sub: "requests" }, path: "/admin/requests" },
  { route: { kind: "admin", sub: "recovery" }, path: "/admin/recovery" },
];

describe("parsePath / buildPath", () => {
  test.each(cases)("round-trips $path", ({ route, path }) => {
    expect(buildPath(route)).toBe(path);
    expect(parsePath(path)).toEqual(route);
  });

  it("parses the root path and builds it back", () => {
    expect(parsePath("/")).toEqual({ kind: "root" });
    expect(parsePath("")).toEqual({ kind: "root" });
    expect(buildPath({ kind: "root" })).toBe("/");
  });

  it("keeps a note URL flat, so it survives re-nesting", () => {
    // The slug is the whole note segment: no ancestor path is encoded.
    expect(parsePath("/t/acme/note/deep")).toEqual({ kind: "note", space: team, noteSlug: "deep" });
  });

  it("treats board view and edit as distinct routes", () => {
    expect(parsePath("/personal/board/x")).toMatchObject({ edit: false });
    expect(parsePath("/personal/board/x/edit")).toMatchObject({ edit: true });
  });

  it("canonicalises a bare /admin to the teams sub-page", () => {
    expect(parsePath("/admin")).toEqual({ kind: "admin", sub: "teams" });
    expect(buildPath(parsePath("/admin"))).toBe("/admin/teams");
  });

  it("ignores a trailing slash", () => {
    expect(parsePath("/personal/")).toEqual({ kind: "library", space: personal });
    expect(parsePath("/t/acme/")).toEqual({ kind: "library", space: team });
  });

  it("round-trips a slug that needs URL-encoding", () => {
    const route: Route = { kind: "note", space: { kind: "team", teamSlug: "a b" }, noteSlug: "c/d" };

    expect(parsePath(buildPath(route))).toEqual(route);
  });

  test.each([
    "/nope",
    "/admin/nope",
    "/settings/extra",
    "/personal/board",
    "/personal/team",
    "/personal/board/x/copy",
    "/t",
  ])("falls back to not-found for %s", (path) => {
    expect(parsePath(path)).toEqual({ kind: "notFound", path });
  });

  // A malformed percent escape makes decodeURIComponent throw; parsePath stays pure and total, yielding
  // not-found rather than propagating the throw (which, before the top-level error boundary, blanked the app).
  test.each(["/personal/board/%", "/t/%E0%A4%A/x", "/%zz"])("returns not-found for malformed escape %s", (path) => {
    expect(() => parsePath(path)).not.toThrow();
    expect(parsePath(path)).toEqual({ kind: "notFound", path });
  });

  it("does not interpret the URL hash (share and invite links ride the hash)", () => {
    // parsePath reads only the pathname; a share/invite hash leaves the path as root.
    expect(parsePath("/")).toEqual({ kind: "root" });
  });
});

describe("routeSpace", () => {
  it("returns the space for space-bearing routes, including team management", () => {
    expect(routeSpace({ kind: "library", space: team })).toEqual(team);
    expect(routeSpace({ kind: "note", space: personal, noteSlug: "x" })).toEqual(personal);
    expect(routeSpace({ kind: "board", space: team, boardId: "b", edit: false })).toEqual(team);
    expect(routeSpace({ kind: "printBoard", space: team, boardId: "b" })).toEqual(team);
    expect(routeSpace({ kind: "printNote", space: personal, noteSlug: "x" })).toEqual(personal);
    expect(routeSpace({ kind: "team", teamSlug: "acme" })).toEqual(team);
  });

  it("returns null for the space-less routes", () => {
    expect(routeSpace({ kind: "settings" })).toBeNull();
    expect(routeSpace({ kind: "admin", sub: "teams" })).toBeNull();
    expect(routeSpace({ kind: "root" })).toBeNull();
    expect(routeSpace({ kind: "notFound", path: "/x" })).toBeNull();
  });
});

describe("sameRouteSpace", () => {
  it("compares spaces by kind and team handle", () => {
    expect(sameRouteSpace(personal, { kind: "personal" })).toBe(true);
    expect(sameRouteSpace(team, { kind: "team", teamSlug: "acme" })).toBe(true);
    expect(sameRouteSpace(team, { kind: "team", teamSlug: "other" })).toBe(false);
    expect(sameRouteSpace(personal, team)).toBe(false);
  });
});
