import type { HTMLAttributes } from "react";

import type { ClipQuery } from "./data";

/** What a tooltip says, and the clips a tap on it can play. */
export type TipContent = { lines: string[]; clips?: ClipQuery };

export type TipApi = {
  show: (e: { clientX: number; clientY: number }, c: TipContent, pinned: boolean) => void;
  hide: (force?: boolean) => void;
};

/** Props that make an element show `c` in its TipBox's tooltip. */
export type Tip = (c: TipContent) => Pick<HTMLAttributes<Element>, "onPointerMove" | "onPointerLeave" | "onClick">;
