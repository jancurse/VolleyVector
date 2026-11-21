import { useEffect, useMemo } from "react";
import type { JSX, ReactNode } from "react";
import { Cell, Grid, Gridline, useGridRef } from "react-resizable-panels";
import type { GridLayout } from "react-resizable-panels";

import { TRACKER_CELL, TRACKER_GRIDLINE } from "../../ui/styles";
import { paneStore, storedLayout } from "../paneStore";

/** Where the clip list sits: in a full-height column beside the video, or under it. */
type ClipsPlace = "beside" | "below";

const { read, write } = paneStore("volleyvector:highlights:layout");

/** Each placement's sizes before anything is dragged, as shares of the grid. */
const DEFAULTS: GridLayout = { columns: { main: 72, side: 28 }, rows: { top: 70, bottom: 30 } };

/** A window narrower than this has no room for the clips beside the video, in pixels. */
const BESIDE_MIN_WIDTH = 1400;

/** Where the clips sit, as last chosen in this browser. Until then they sit where the window has room for them. */
export function initialPlace(): ClipsPlace {
  const { place } = read();

  return place === "beside" || place === "below" ? place : window.innerWidth >= BESIDE_MIN_WIDTH ? "beside" : "below";
}

export const savePlace = (place: ClipsPlace): void => write({ place });

type HighlightPanesProps = {
  place: ClipsPlace;
  video: ReactNode;
  clips: ReactNode;
};

/**
 * The highlights' video and clips on one resizable grid, the clips beside the video or under it. The line
 * between them drags, and each placement remembers its own sizes in this browser. The video's cell is the same
 * element in both placements, so moving the clips never reloads the video.
 */
export function HighlightPanes({ place, video, clips }: HighlightPanesProps): JSX.Element {
  const grid = useGridRef();
  const beside = place === "beside";
  const layout = useMemo(() => storedLayout(read()[place], ["main", "side"], ["top", "bottom"], DEFAULTS), [place]);

  useEffect(() => {
    grid.current?.setLayout(layout);
  }, [grid, layout]);

  return (
    <Grid
      gridRef={grid}
      className="min-h-0 flex-1"
      columns={[
        { id: "main", minSize: "30" },
        { id: "side", minSize: 220 },
      ]}
      rows={[
        { id: "top", minSize: "30" },
        { id: "bottom", minSize: 120 },
      ]}
      defaultLayout={layout}
      onLayoutChanged={(changed, meta) => {
        // Only what was dragged is remembered, not the sizes the grid settles on by itself.
        if (meta.isUserInteraction) write({ [place]: meta.requestedLayout ?? changed });
      }}
    >
      <Cell className={TRACKER_CELL} column={0} row={0} columnSpan={beside ? 1 : 2} rowSpan={beside ? 2 : 1}>
        {video}
      </Cell>
      <Cell
        className={TRACKER_CELL}
        column={beside ? 1 : 0}
        row={beside ? 0 : 1}
        columnSpan={beside ? 1 : 2}
        rowSpan={beside ? 2 : 1}
      >
        {clips}
      </Cell>
      {beside ? (
        <Gridline className={TRACKER_GRIDLINE.column} type="column" column={1} />
      ) : (
        <Gridline className={TRACKER_GRIDLINE.row} type="row" row={1} columnSpan={2} />
      )}
    </Grid>
  );
}
