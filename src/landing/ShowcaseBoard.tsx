import type { JSX } from "react";

import type { Board } from "../boards/types";
import { BoardView } from "../editor/BoardView";

// A read-only landing board rendered through the app's own BoardView, so it is the app's view exactly,
// not a copy of it: every change to BoardView shows here automatically and the two cannot drift. The
// landing drops the back button, actions, and meta, and auto-plays a Sequence (held still under reduced
// motion).
export function ShowcaseBoard({ board }: { board: Board }): JSX.Element {
  return <BoardView board={board} autoPlay />;
}
