// Which library is on screen. Every board and topic lives in exactly one space: a team's shared
// library, or a user's private personal space. Content loads and creation are scoped to the active one.
export type Space = { kind: "personal" } | { kind: "team"; teamId: string };
