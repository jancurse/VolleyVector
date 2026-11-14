import { createContext } from "react";

import type { ClipQuery } from "./data";

/** How many highlight clips a stat covers, and how to play them (absent on the exported page). */
export const ClipsContext = createContext<{ count: (q: ClipQuery) => number; play?: (q: ClipQuery) => void }>({
  count: () => 0,
});
