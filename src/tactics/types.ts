import type { CourtMode } from "../court/roles";
import type { Marker } from "../court/types";

// A tactic is one static arrangement of markers on the court, with a title and a markdown
// description. Tags, author, and sharing arrive with later phases; Stage 2 keeps only what the
// client-side editor needs, plus timestamps so the library can order by recency.
export type Tactic = {
  id: string;
  title: string;
  /** Markdown. */
  description: string;
  /** Which role family the editor offers for this tactic. */
  mode: CourtMode;
  markers: Marker[];
  createdAt: number;
  updatedAt: number;
};
