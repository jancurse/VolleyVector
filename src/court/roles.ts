// Marker roles and their visual language. A role drives a marker's colour and its default label;
// the palette is fixed (not theme-dependent) so a marker's identity colour stays constant in both
// light and dark themes — a blue outside hitter is always blue.

export type MarkerRole = "setter" | "outside" | "middle" | "opposite" | "libero" | "ball";

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
  ball: { code: "", name: "Ball", fill: "#F4EFE6", ring: "#C9BFAE", text: "#2A2620" },
};

/** The marker's visible label: an explicit override, otherwise the role's default code. */
export function markerLabel(role: MarkerRole, override?: string): string {
  return override ?? ROLES[role].code;
}
