import { useEffect, useMemo } from "react";
import type { JSX, ReactNode } from "react";
import { Cell, Grid, Gridline, useGridRef } from "react-resizable-panels";
import type { GridLayout } from "react-resizable-panels";

import { TRACKER_CELL, TRACKER_GRIDLINE } from "../../ui/styles";
import { paneStore, storedLayout } from "../paneStore";

/** Where the entry sits: in a full-height column beside the video, or under it next to the stats. */
export type Arrangement = "beside" | "below";

const STORE = "volleyvector:tracker:layout";

/** Each arrangement's sizes before the coach drags anything, as shares of the grid. */
const DEFAULTS: Record<Arrangement, GridLayout> = {
  beside: { columns: { main: 72, side: 28 }, rows: { top: 66, bottom: 34 } },
  below: { columns: { main: 60, side: 40 }, rows: { top: 68, bottom: 32 } },
};

const { read, write } = paneStore(STORE);

const layoutOf = (arrangement: Arrangement): GridLayout =>
  storedLayout(read()[arrangement], ["main", "side"], ["top", "bottom"], DEFAULTS[arrangement]);

/** The arrangement last chosen in this browser, or the one that suits the window's shape. */
export function initialArrangement(): Arrangement {
  const saved = read().arrangement;

  if (saved === "beside" || saved === "below") return saved;

  return window.innerWidth >= window.innerHeight * 1.5 ? "beside" : "below";
}

export const saveArrangement = (arrangement: Arrangement): void => write({ arrangement });

type TrackerPanesProps = {
  arrangement: Arrangement;
  video: ReactNode;
  actions: ReactNode;
  stats: ReactNode;
};

/**
 * The tracker's three panes on one resizable grid. Beside, the video sits over the stats with the actions down
 * the right. Below, the video spans the top with the actions and the stats under it. Every line between panes
 * drags, and each arrangement remembers its own sizes in this browser. The video's cell is the same element in
 * both, so flipping the arrangement never reloads the video.
 */
export function TrackerPanes({ arrangement, video, actions, stats }: TrackerPanesProps): JSX.Element {
  const grid = useGridRef();
  const beside = arrangement === "beside";
  const layout = useMemo(() => layoutOf(arrangement), [arrangement]);

  // A flipped arrangement takes its own remembered sizes.
  useEffect(() => {
    grid.current?.setLayout(layout);
  }, [grid, layout]);

  return (
    <Grid
      gridRef={grid}
      className="min-h-0 flex-1"
      columns={[
        { id: "main", minSize: "30" },
        { id: "side", minSize: 280 },
      ]}
      rows={[
        { id: "top", minSize: "25" },
        { id: "bottom", minSize: 96 },
      ]}
      defaultLayout={layout}
      onLayoutChanged={(layout, meta) => {
        // Only what the coach dragged is remembered, not the sizes the grid settles on by itself.
        if (meta.isUserInteraction) write({ [arrangement]: meta.requestedLayout ?? layout });
      }}
    >
      <Cell className={TRACKER_CELL} column={0} row={0} columnSpan={beside ? 1 : 2}>
        {video}
      </Cell>
      <Cell className={TRACKER_CELL} column={beside ? 1 : 0} row={beside ? 0 : 1} rowSpan={beside ? 2 : 1}>
        {actions}
      </Cell>
      <Cell className={TRACKER_CELL} column={beside ? 0 : 1} row={1}>
        {stats}
      </Cell>
      {beside ? (
        <Gridline className={TRACKER_GRIDLINE.column} type="column" column={1} />
      ) : (
        <Gridline className={TRACKER_GRIDLINE.column} type="column" column={1} row={1} rowSpan={1} />
      )}
      {beside ? (
        <Gridline className={TRACKER_GRIDLINE.row} type="row" row={1} column={0} columnSpan={1} />
      ) : (
        <Gridline className={TRACKER_GRIDLINE.row} type="row" row={1} />
      )}
    </Grid>
  );
}
