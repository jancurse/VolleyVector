import type { Topic } from "../topics/types";
import type { Space } from "../workspace/space";
import type { TeamRef } from "../workspace/useWorkspace";
import type { Route, RouteSpace } from "./route";

// Resolve the app's entities (spaces, teams, topics, boards) to and from a `Route`, so components never
// hand-build URLs. The only place the URL's human handle is read off an entity is the two accessors
// below: they read the persisted `slug` column (Stage 4). The lookups still match an old id link, and
// `canonicalRoute` rewrites such a link to its slug form.

/** The URL handle for a topic: its persisted slug. */
export function topicSlugOf(topic: Topic): string {
  return topic.slug;
}

/** The URL handle for a team: its persisted slug. */
export function teamSlugOf(team: TeamRef): string {
  return team.slug;
}

/** Map an active `Space` to its URL form, looking the team's handle up in the team list. */
export function routeSpaceForSpace(space: Space, teams: readonly TeamRef[]): RouteSpace {
  if (space.kind === "personal") return { kind: "personal" };

  const team = teams.find((t) => t.teamId === space.teamId);

  return { kind: "team", teamSlug: team ? teamSlugOf(team) : space.teamId };
}

/** Map a URL space back to an active `Space`, resolving the team handle to its id. */
export function spaceForRouteSpace(routeSpace: RouteSpace, teams: readonly TeamRef[]): Space {
  if (routeSpace.kind === "personal") return { kind: "personal" };

  const team = teams.find((t) => teamSlugOf(t) === routeSpace.teamSlug || t.teamId === routeSpace.teamSlug);

  return { kind: "team", teamId: team ? team.teamId : routeSpace.teamSlug };
}

/** The team id behind a URL handle (slug, or an old id link), or null if it names no team the user can reach. */
export function findTeamId(teams: readonly TeamRef[], slug: string): string | null {
  return teams.find((t) => teamSlugOf(t) === slug || t.teamId === slug)?.teamId ?? null;
}

/** The topic id behind a URL handle (slug, or an old id link), or null if it names no loaded topic. */
export function findTopicId(topics: readonly Topic[], slug: string): string | null {
  return topics.find((t) => topicSlugOf(t) === slug || t.id === slug)?.id ?? null;
}

/** Rebuild a route's URL handles to the current slugs where they resolve (an old id link canonicalises to
 *  its slug form), leaving any unresolvable handle untouched. */
export function canonicalRoute(route: Route, teams: readonly TeamRef[], topics: readonly Topic[]): Route {
  const findTeam = (slug: string) => teams.find((t) => teamSlugOf(t) === slug || t.teamId === slug);

  const canonicalSpace = (space: RouteSpace): RouteSpace => {
    const team = space.kind === "team" ? findTeam(space.teamSlug) : undefined;

    return team ? { kind: "team", teamSlug: teamSlugOf(team) } : space;
  };

  switch (route.kind) {
    case "library":
    case "board":
    case "printBoard":
      return { ...route, space: canonicalSpace(route.space) };
    case "topic":
    case "printTopic": {
      const topic = topics.find((t) => topicSlugOf(t) === route.topicSlug || t.id === route.topicSlug);

      return { ...route, space: canonicalSpace(route.space), topicSlug: topic ? topicSlugOf(topic) : route.topicSlug };
    }
    case "team": {
      const team = findTeam(route.teamSlug);

      return team ? { ...route, teamSlug: teamSlugOf(team) } : route;
    }
    default:
      return route;
  }
}

export function libraryRoute(space: Space, teams: readonly TeamRef[]): Route {
  return { kind: "library", space: routeSpaceForSpace(space, teams) };
}

export function topicRoute(space: Space, teams: readonly TeamRef[], topic: Topic): Route {
  return { kind: "topic", space: routeSpaceForSpace(space, teams), topicSlug: topicSlugOf(topic) };
}

export function boardRoute(space: Space, teams: readonly TeamRef[], boardId: string, edit: boolean): Route {
  return { kind: "board", space: routeSpaceForSpace(space, teams), boardId, edit };
}

export function boardPrintRoute(space: Space, teams: readonly TeamRef[], boardId: string): Route {
  return { kind: "printBoard", space: routeSpaceForSpace(space, teams), boardId };
}

export function topicPrintRoute(space: Space, teams: readonly TeamRef[], topic: Topic): Route {
  return { kind: "printTopic", space: routeSpaceForSpace(space, teams), topicSlug: topicSlugOf(topic) };
}

export function teamRoute(teamId: string, teams: readonly TeamRef[]): Route {
  const team = teams.find((t) => t.teamId === teamId);

  return { kind: "team", teamSlug: team ? teamSlugOf(team) : teamId };
}
