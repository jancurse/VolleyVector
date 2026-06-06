// Marker roles and their visual language. A role drives a marker's colour and its default label;
// the palette is fixed (not theme-dependent) so a marker's identity colour stays constant in both
// light and dark themes — a blue outside hitter is always blue.

export type MarkerRole = "setter" | "outside" | "middle" | "opposite" | "libero" | "ball" | "coach" | "player";

// The editor works in one of two modes. "Positions" offers the volleyball roles; "basic" offers
// generic, position-independent markers (a coach and numbered players) for simpler diagrams. The
// mode only selects which roles the palette and inspector present — every role renders identically.
export type CourtMode = "positions" | "basic";

export type RoleStyle = {
  /** Default label code, e.g. "OH". Repeated roles get a number appended at authoring time (OH1, OH2). */
  code: string;
  /** Human-readable role name, used in the legend and accessible labels. */
  name: string;
  /** Disc fill colour. */
  fill: string;
  /** Slightly darker shade of the fill, used for the marker's ring. */
  ring: string;
  /** Label text colour, chosen for contrast against the fill. */
  text: string;
};

export const ROLES: Record<MarkerRole, RoleStyle> = {
  setter: { code: "S", name: "Setter", fill: "#C77A18", ring: "#9A5B10", text: "#FFFFFF" },
  outside: { code: "OH", name: "Outside hitter", fill: "#2F6FE0", ring: "#1C4FAE", text: "#FFFFFF" },
  middle: { code: "MB", name: "Middle blocker", fill: "#16A085", ring: "#0E7A64", text: "#FFFFFF" },
  opposite: { code: "OPP", name: "Opposite", fill: "#E0533B", ring: "#B23A26", text: "#FFFFFF" },
  libero: { code: "L", name: "Libero", fill: "#8B5CF6", ring: "#6B3FD0", text: "#FFFFFF" },
  ball: { code: "", name: "Ball", fill: "#2150BE", ring: "#16357F", text: "#FFFFFF" },
  coach: { code: "C", name: "Coach", fill: "#566273", ring: "#3C4654", text: "#FFFFFF" },
  player: { code: "P", name: "Player", fill: "#3E6FD6", ring: "#294EA6", text: "#FFFFFF" },
};

/** The roles offered by each editor mode, in palette order. */
export const MODE_ROLES: Record<CourtMode, MarkerRole[]> = {
  positions: ["setter", "outside", "middle", "opposite", "libero", "ball"],
  basic: ["coach", "player", "ball"],
};

// A curated set of marker colours a coach can apply in basic mode (e.g. two teams). They reuse the
// fixed role palette so everything stays on the same visual language; "blue" and "slate" match the
// player and coach defaults, so a recoloured marker can always be set back.
export type ColorKey = "blue" | "red" | "green" | "amber" | "violet" | "slate";

export type ColorStyle = { name: string; fill: string; ring: string; text: string };

export const COLOR_KEYS: ColorKey[] = ["blue", "red", "green", "amber", "violet", "slate"];

export const MARKER_COLORS: Record<ColorKey, ColorStyle> = {
  blue: { name: "Blue", fill: "#3E6FD6", ring: "#294EA6", text: "#FFFFFF" },
  red: { name: "Red", fill: "#E0533B", ring: "#B23A26", text: "#FFFFFF" },
  green: { name: "Green", fill: "#16A085", ring: "#0E7A64", text: "#FFFFFF" },
  amber: { name: "Amber", fill: "#C77A18", ring: "#9A5B10", text: "#FFFFFF" },
  violet: { name: "Violet", fill: "#8B5CF6", ring: "#6B3FD0", text: "#FFFFFF" },
  slate: { name: "Slate", fill: "#566273", ring: "#3C4654", text: "#FFFFFF" },
};

/** The marker's visible label: an explicit override, otherwise the role's default code. */
export function markerLabel(role: MarkerRole, override?: string): string {
  return override ?? ROLES[role].code;
}
