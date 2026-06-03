import type { CourtMode } from "../court/roles";
import type { Marker } from "../court/types";

// A tactic is one static arrangement of markers on the court, with a title and a markdown
// description. Author and sharing arrive with later phases; the client-side editor keeps only what it
// needs, plus timestamps so the library can order by recency and organising tags it can filter on.
export type Tactic = {
  id: string;
  title: string;
  /** Markdown. */
  description: string;
  /** Which role family the editor offers for this tactic. */
  mode: CourtMode;
  markers: Marker[];
  /** Free-form organising tags the library filters by. */
  tags: string[];
  createdAt: number;
  updatedAt: number;
};
