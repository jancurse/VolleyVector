// Path-based routing for the authenticated app. The URL is the single source of truth for the active
// space, the browse selection, and the open board. This module is pure: `parsePath` reads a pathname
// into a `Route`, `buildPath` writes one back, and the two round-trip. `useRoute` holds the live route
// and `links.ts` resolves app entities (spaces, notes, boards) to and from a `Route`.
//
// The share and invite links keep their own hash routes (`#/share/...`, `#/invite/...`). They are
// orthogonal to this path router: `App` checks them first, and this module never touches the hash.

/** A space in the URL. The team is identified by an opaque handle: its id today, its slug from Stage 4. */
export type RouteSpace = { kind: "personal" } | { kind: "team"; teamSlug: string };

/** Which admin sub-page is shown. `/admin` canonicalises to `/admin/teams`. */
export type AdminSub = "teams" | "accounts" | "recovery";

export type Route =
  // The bare `/` URL. It carries no space yet, so `App` resolves the landing space once the workspace
  // loads and `replaceState`s to a concrete library route.
  | { kind: "root" }
  | { kind: "library"; space: RouteSpace }
  | { kind: "note"; space: RouteSpace; noteSlug: string }
  | { kind: "board"; space: RouteSpace; boardId: string; edit: boolean }
  // The chrome-free print/handout surfaces: a board or a note rendered as a paper document.
  | { kind: "printBoard"; space: RouteSpace; boardId: string }
  | { kind: "printNote"; space: RouteSpace; noteSlug: string }
  | { kind: "settings" }
  | { kind: "team"; teamSlug: string }
  | { kind: "admin"; sub: AdminSub }
  | { kind: "notFound"; path: string };

const ADMIN_SUBS: readonly AdminSub[] = ["teams", "accounts", "recovery"];

function isAdminSub(value: string): value is AdminSub {
  return (ADMIN_SUBS as readonly string[]).includes(value);
}

/** The URL path prefix for a space: `/personal` or `/t/<team>`. */
function spacePrefix(space: RouteSpace): string {
  return space.kind === "personal" ? "/personal" : `/t/${encodeURIComponent(space.teamSlug)}`;
}

/** Read a pathname into a `Route`. Pure and total: an unrecognised path — including one with a malformed
 *  `%` escape that `decodeURIComponent` would throw on — yields `notFound`. */
export function parsePath(pathname: string): Route {
  const notFound: Route = { kind: "notFound", path: pathname };

  let segs: string[];

  try {
    segs = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return notFound;
  }

  if (segs.length === 0) return { kind: "root" };

  if (segs[0] === "settings") return segs.length === 1 ? { kind: "settings" } : notFound;

  if (segs[0] === "admin") {
    if (segs.length === 1) return { kind: "admin", sub: "teams" };

    return segs.length === 2 && isAdminSub(segs[1]) ? { kind: "admin", sub: segs[1] } : notFound;
  }

  let space: RouteSpace;
  let rest: string[];

  if (segs[0] === "personal") {
    space = { kind: "personal" };
    rest = segs.slice(1);
  } else if (segs[0] === "t" && segs.length >= 2) {
    space = { kind: "team", teamSlug: segs[1] };
    rest = segs.slice(2);
  } else {
    return notFound;
  }

  if (rest.length === 0) return { kind: "library", space };

  if (rest[0] === "team" && rest.length === 1) {
    return space.kind === "team" ? { kind: "team", teamSlug: space.teamSlug } : notFound;
  }

  // "topic" is the segment's legacy name; an old link parses, then canonicalises to its /note/ form.
  if ((rest[0] === "note" || rest[0] === "topic") && rest.length === 2)
    return { kind: "note", space, noteSlug: rest[1] };

  if ((rest[0] === "note" || rest[0] === "topic") && rest.length === 3 && rest[2] === "print") {
    return { kind: "printNote", space, noteSlug: rest[1] };
  }

  if (rest[0] === "board" && rest.length === 2) return { kind: "board", space, boardId: rest[1], edit: false };

  if (rest[0] === "board" && rest.length === 3 && rest[2] === "edit") {
    return { kind: "board", space, boardId: rest[1], edit: true };
  }

  if (rest[0] === "board" && rest.length === 3 && rest[2] === "print") {
    return { kind: "printBoard", space, boardId: rest[1] };
  }

  return notFound;
}

/** Write a `Route` back to its canonical pathname. The inverse of `parsePath` for every routable kind;
 *  `root` has no canonical path (it redirects) and `notFound` returns the path it failed to parse. */
export function buildPath(route: Route): string {
  switch (route.kind) {
    case "root":
      return "/";
    case "library":
      return spacePrefix(route.space);
    case "note":
      return `${spacePrefix(route.space)}/note/${encodeURIComponent(route.noteSlug)}`;
    case "board":
      return `${spacePrefix(route.space)}/board/${encodeURIComponent(route.boardId)}${route.edit ? "/edit" : ""}`;
    case "printBoard":
      return `${spacePrefix(route.space)}/board/${encodeURIComponent(route.boardId)}/print`;
    case "printNote":
      return `${spacePrefix(route.space)}/note/${encodeURIComponent(route.noteSlug)}/print`;
    case "team":
      return `/t/${encodeURIComponent(route.teamSlug)}/team`;
    case "settings":
      return "/settings";
    case "admin":
      return `/admin/${route.sub}`;
    case "notFound":
      return route.path;
  }
}

/** The space a route lives in, or null for the space-less routes (settings, admin, root, not-found).
 *  Team management belongs to its team's space. Drives the active-space sync in `App`. */
export function routeSpace(route: Route): RouteSpace | null {
  switch (route.kind) {
    case "library":
    case "note":
    case "board":
    case "printBoard":
    case "printNote":
      return route.space;
    case "team":
      return { kind: "team", teamSlug: route.teamSlug };
    default:
      return null;
  }
}

export function sameRouteSpace(a: RouteSpace, b: RouteSpace): boolean {
  return a.kind === "personal" ? b.kind === "personal" : b.kind === "team" && a.teamSlug === b.teamSlug;
}
