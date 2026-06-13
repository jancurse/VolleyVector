// Which library is on screen. Every board and note lives in exactly one space: a team's shared
// library, or a user's private personal space. Content loads and creation are scoped to the active one.
export type Space = { kind: "personal" } | { kind: "team"; teamId: string };

/** Whether two spaces are the same library, so a route-driven space sync only switches when it must. */
export function sameSpace(a: Space, b: Space): boolean {
  return a.kind === "personal" ? b.kind === "personal" : b.kind === "team" && a.teamId === b.teamId;
}
