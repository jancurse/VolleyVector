import type { ComponentPropsWithoutRef, JSX, ReactNode } from "react";

import { cx, TABLE, TABLE_CELL, TABLE_FRAME, TABLE_HEAD_CELL } from "./styles";

// The shared management table. The frame, the table chrome, and the sizing live here, so a table renders
// through one component instead of repeating the tokens at each call site. Callers supply their own
// <thead>/<tbody> rows and use TableHeadCell/TableCell for the cells. Width is a named variant, never a
// per-table guess, and every variant is a fixed width so a table is the same size regardless of its rows:
// "fill" is the standard card width, "compact" a narrower one for light, few-column tables.
type TableWidth = "fill" | "compact";

const WIDTH: Record<TableWidth, string> = {
  fill: "max-w-2xl",
  compact: "max-w-md",
};

export function Table({ width = "fill", children }: { width?: TableWidth; children: ReactNode }): JSX.Element {
  return (
    <div className={cx(TABLE_FRAME, WIDTH[width])}>
      <table className={TABLE}>{children}</table>
    </div>
  );
}

export function TableHeadCell({ className, ...props }: ComponentPropsWithoutRef<"th">): JSX.Element {
  return <th className={cx(TABLE_HEAD_CELL, className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentPropsWithoutRef<"td">): JSX.Element {
  return <td className={cx(TABLE_CELL, className)} {...props} />;
}
