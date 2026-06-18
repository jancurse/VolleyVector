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

// The fills sit in a narrow lightness band (0.56–0.66 L) and avoid the red and green hue ranges, so
// the five roles stay distinct under protan/deutan/tritan colour-blindness and never collide with the
// --danger hue. Each ring is the fill ~0.14 L darker. Player shares Outside's blue and Coach a quiet
// neutral, so MARKER_COLORS.blue/slate match them and a recoloured marker resets to its role default.
export const ROLES: Record<MarkerRole, RoleStyle> = {
  setter: { code: "S", name: "Setter", fill: "oklch(0.64 0.13 72)", ring: "oklch(0.50 0.12 68)", text: "#FFFFFF" },
  outside: {
    code: "OH",
    name: "Outside hitter",
    fill: "oklch(0.58 0.14 258)",
    ring: "oklch(0.45 0.13 260)",
    text: "#FFFFFF",
  },
  middle: {
    code: "MB",
    name: "Middle blocker",
    fill: "oklch(0.66 0.11 188)",
    ring: "oklch(0.51 0.10 190)",
    text: "#FFFFFF",
  },
  opposite: {
    code: "OPP",
    name: "Opposite",
    fill: "oklch(0.61 0.15 350)",
    ring: "oklch(0.47 0.14 352)",
    text: "#FFFFFF",
  },
  libero: { code: "L", name: "Libero", fill: "oklch(0.56 0.14 300)", ring: "oklch(0.44 0.13 300)", text: "#FFFFFF" },
  ball: { code: "", name: "Ball", fill: "#2150BE", ring: "#16357F", text: "#FFFFFF" },
  coach: { code: "C", name: "Coach", fill: "oklch(0.52 0.02 250)", ring: "oklch(0.40 0.02 250)", text: "#FFFFFF" },
  player: { code: "P", name: "Player", fill: "oklch(0.58 0.14 258)", ring: "oklch(0.45 0.13 260)", text: "#FFFFFF" },
};

/** The roles offered by each editor mode, in palette order. */
export const MODE_ROLES: Record<CourtMode, MarkerRole[]> = {
  positions: ["setter", "outside", "middle", "opposite", "libero", "ball"],
  basic: ["coach", "player", "ball"],
};

// A curated set of marker colours a coach can apply in basic mode (e.g. two teams), and the ink palette
// the annotation tools draw with. They reuse the colour-blind-safe role hues with no red/green pair, so
// everything stays on one visual language; the most-distinct pair (blue, amber) leads the list. "blue"
// and "slate" match the player and coach role defaults exactly, so a recoloured marker can always be
// set back to its role colour (the inspector matches on fill).
export type ColorKey = "blue" | "amber" | "teal" | "magenta" | "violet" | "slate";

export type ColorStyle = { name: string; fill: string; ring: string; text: string };

export const COLOR_KEYS: ColorKey[] = ["blue", "amber", "teal", "magenta", "violet", "slate"];

export const MARKER_COLORS: Record<ColorKey, ColorStyle> = {
  blue: { name: "Blue", fill: "oklch(0.58 0.14 258)", ring: "oklch(0.45 0.13 260)", text: "#FFFFFF" },
  amber: { name: "Amber", fill: "oklch(0.66 0.12 72)", ring: "oklch(0.52 0.11 68)", text: "#FFFFFF" },
  teal: { name: "Teal", fill: "oklch(0.66 0.11 188)", ring: "oklch(0.51 0.10 190)", text: "#FFFFFF" },
  magenta: { name: "Magenta", fill: "oklch(0.61 0.15 350)", ring: "oklch(0.47 0.14 352)", text: "#FFFFFF" },
  violet: { name: "Violet", fill: "oklch(0.56 0.14 300)", ring: "oklch(0.44 0.13 300)", text: "#FFFFFF" },
  slate: { name: "Slate", fill: "oklch(0.52 0.02 250)", ring: "oklch(0.40 0.02 250)", text: "#FFFFFF" },
};

// Colour keys retired in the colour-blind-safe retune. Content saved before it may still store one on a
// marker or annotation, or in an exported bundle, so every read path maps a stored key through
// resolveColorKey before a MARKER_COLORS lookup. `red` became `magenta`, `green` became `teal`.
const LEGACY_COLOR_KEYS: Record<string, ColorKey> = { red: "magenta", green: "teal" };

/** Map a stored colour key to a current one: a legacy key to its replacement, a current key unchanged,
 *  anything else to null (an unknown key the caller rejects or drops). */
export function resolveColorKey(key: string): ColorKey | null {
  if ((COLOR_KEYS as string[]).includes(key)) return key as ColorKey;

  return LEGACY_COLOR_KEYS[key] ?? null;
}

/** The marker's visible label: an explicit override, otherwise the role's default code. */
export function markerLabel(role: MarkerRole, override?: string): string {
  return override ?? ROLES[role].code;
}
