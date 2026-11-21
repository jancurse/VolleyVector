import type { GridLayout } from "react-resizable-panels";

type Stored = Record<string, unknown>;

/** What a pane workspace remembers in this browser under `key`: its sizes and how it is arranged. */
export function paneStore(key: string): { read: () => Stored; write: (patch: Stored) => void } {
  const read = (): Stored => {
    try {
      return (JSON.parse(localStorage.getItem(key) ?? "{}") as Stored) ?? {};
    } catch {
      return {};
    }
  };

  return {
    read,
    write: (patch) => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...read(), ...patch }));
      } catch {
        // Storage blocked: the sizes last for this visit only.
      }
    },
  };
}

/** Whether a stored axis holds a share for exactly the tracks the grid has, so the grid accepts it. */
const validAxis = (axis: unknown, ids: readonly string[]): axis is GridLayout["columns"] =>
  !!axis &&
  typeof axis === "object" &&
  Object.keys(axis).length === ids.length &&
  ids.every((id) => Number.isFinite((axis as Record<string, unknown>)[id]));

/** The stored layout when it fits the grid's tracks, otherwise the default. */
export const storedLayout = (
  saved: unknown,
  columns: readonly string[],
  rows: readonly string[],
  fallback: GridLayout
): GridLayout => {
  const layout = saved as Partial<GridLayout> | undefined;

  return validAxis(layout?.columns, columns) && validAxis(layout?.rows, rows)
    ? { columns: layout.columns, rows: layout.rows }
    : fallback;
};
