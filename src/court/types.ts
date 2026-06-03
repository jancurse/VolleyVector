import type { NormalizedPoint } from "./geometry";
import type { ColorKey, MarkerRole } from "./roles";

// A marker is one object on the court — a player or the ball. Its `id` is a stable identity that
// will persist across a drill's steps (the spine decision that makes playback and derived arrows
// nearly free); for a static tactic there is simply one position per marker.
export type Marker = {
  id: string;
  role: MarkerRole;
  position: NormalizedPoint;
  /** Optional label override; when absent the role's default code is used. */
  label?: string;
  /** Optional colour override (basic mode); when absent the role's colour is used. */
  color?: ColorKey;
};
