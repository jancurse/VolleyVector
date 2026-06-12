import type { Board } from "../boards/types";
import { boardRoute, findNoteId, libraryRoute, spaceForRouteSpace, noteRoute } from "../routing/links";
import { routeSpace, type Route } from "../routing/route";
import type { Note } from "../notes/types";
import type { TeamRef } from "../workspace/useWorkspace";

// The top bar's breadcrumb, derived purely from the route plus the loaded teams, notes, and boards: the
// space, then on a note page the live note ancestor chain (walked from `parentId` at render, never
// encoded in the URL, so it survives re-nesting), or the board title as a terminal crumb. A board has
// no home note — any number of notes may reference it — so its trail is just space / title. The last
// crumb is the current page; earlier ones link back up the hierarchy.

export type Crumb = { label: string; route: Route };

/** A renderable trail entry: a visible crumb, or the hidden middle of a long trail folded behind one ellipsis. */
export type CrumbItem = { kind: "crumb"; crumb: Crumb } | { kind: "collapsed"; hidden: Crumb[] };

/**
 * Folds a long trail's middle behind an ellipsis so the head (the space) and the tail (the current page
 * and its parent) stay legible. A trail of `max` crumbs or fewer renders in full.
 */
export function collapseCrumbs(crumbs: readonly Crumb[], max = 4): CrumbItem[] {
  if (crumbs.length <= max) return crumbs.map((crumb) => ({ kind: "crumb", crumb }));

  return [
    { kind: "crumb", crumb: crumbs[0] },
    { kind: "collapsed", hidden: crumbs.slice(1, -2) },
    ...crumbs.slice(-2).map((crumb): CrumbItem => ({ kind: "crumb", crumb })),
  ];
}

const ADMIN_LABELS: Record<"teams" | "accounts" | "recovery", string> = {
  teams: "Teams",
  accounts: "Accounts",
  recovery: "Recovery",
};

/** A note's ancestor chain, root first, ending at the note itself. Walks `parentId` live. */
function noteChain(notes: readonly Note[], noteId: string): Note[] {
  const byId = new Map(notes.map((t) => [t.id, t]));
  const chain: Note[] = [];

  let current = byId.get(noteId);

  while (current) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain;
}

export function breadcrumbs(
  route: Route,
  teams: readonly TeamRef[],
  notes: readonly Note[],
  boards: readonly Board[]
): Crumb[] {
  const crumbs: Crumb[] = [];
  const space = routeSpace(route);

  if (space) {
    const resolved = spaceForRouteSpace(space, teams);
    const label =
      resolved.kind === "personal" ? "Personal" : (teams.find((t) => t.teamId === resolved.teamId)?.teamName ?? "Team");

    crumbs.push({ label, route: libraryRoute(resolved, teams) });

    if (route.kind === "note") {
      const id = findNoteId(notes, route.noteSlug);

      for (const note of id ? noteChain(notes, id) : []) {
        crumbs.push({ label: note.title, route: noteRoute(resolved, teams, note) });
      }
    } else if (route.kind === "board") {
      const board = boards.find((b) => b.id === route.boardId);

      crumbs.push({ label: board?.title || "Board", route: boardRoute(resolved, teams, route.boardId, false) });
    } else if (route.kind === "team") {
      crumbs.push({ label: "Members", route });
    }
  } else if (route.kind === "settings") {
    crumbs.push({ label: "Account", route });
  } else if (route.kind === "admin") {
    crumbs.push({ label: "Admin", route: { kind: "admin", sub: "teams" } });
    crumbs.push({ label: ADMIN_LABELS[route.sub], route });
  }

  return crumbs;
}
