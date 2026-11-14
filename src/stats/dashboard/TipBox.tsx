import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { JSX, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Play } from "lucide-react";

import { Button } from "../../ui/Button";
import { CHART_TIP, cx } from "../../ui/styles";
import { ClipsContext } from "./clips";
import type { Tip, TipApi, TipContent } from "./tip";

/**
 * A box showing one tooltip for the stats inside it. Hovering with a mouse shows the counts; a tap or click
 * pins them, with a button that plays the matching clips. `children` gets the props that attach one.
 */
export function TipBox({
  className,
  children,
}: {
  className?: string;
  children: (tip: Tip, api: TipApi) => ReactNode;
}): JSX.Element {
  // The box as state, not a ref: the tooltip api reads it, and children get that api while rendering.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; c: TipContent; pinned: boolean } | null>(null);
  const clips = useContext(ClipsContext);
  const api = useMemo<TipApi>(
    () => ({
      show(e, c, pinned) {
        if (!box) return;

        const r = box.getBoundingClientRect();
        const next = { x: e.clientX - r.left + box.scrollLeft, y: e.clientY - r.top + box.scrollTop, c, pinned };

        // Hovering never replaces a pinned tooltip, so the mouse can reach its clips button.
        setTip((t) => (t?.pinned && !pinned ? t : next));
      },
      hide: (force) => setTip((t) => (t && (force || !t.pinned) ? null : t)),
    }),
    [box]
  );
  const pinned = !!tip?.pinned;

  // A pinned tooltip closes on a press anywhere outside it.
  useEffect(() => {
    if (!pinned) return;

    const away = (e: PointerEvent) => {
      if (!tipRef.current?.contains(e.target as Node)) api.hide(true);
    };

    document.addEventListener("pointerdown", away, true);

    return () => document.removeEventListener("pointerdown", away, true);
  }, [pinned, api]);

  // Keep the tooltip inside the box, flipping it above the pointer near the bottom.
  useLayoutEffect(() => {
    const t = tipRef.current;

    if (!t || !box || !tip) return;

    const sx = box.scrollLeft;
    const sy = box.scrollTop;
    const x = tip.x - sx;
    const y = tip.y - sy;

    t.style.left = `${sx + Math.max(0, Math.min(x + 12, box.clientWidth - t.offsetWidth))}px`;
    t.style.top = `${sy + (y + 12 + t.offsetHeight > box.clientHeight ? Math.max(0, y - 12 - t.offsetHeight) : y + 12)}px`;
  }, [tip, box]);

  const n = tip?.c.clips && clips.play ? clips.count(tip.c.clips) : 0;
  const attach: Tip = (c) => ({
    onPointerMove: (e: ReactPointerEvent) => e.pointerType === "mouse" && api.show(e, c, false),
    onPointerLeave: (e: ReactPointerEvent) => e.pointerType === "mouse" && api.hide(),
    onClick: (e: ReactMouseEvent) => {
      e.stopPropagation();
      api.show(e, c, true);
    },
  });

  return (
    <div ref={setBox} className={cx("relative", className)} onClick={() => api.hide(true)}>
      {children(attach, api)}
      {tip && (
        <div
          ref={tipRef}
          role="tooltip"
          className={cx(CHART_TIP, tip.pinned && "pointer-events-auto")}
          onClick={(e) => e.stopPropagation()}
        >
          {tip.c.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "text-text-dim" : undefined}>
              {l}
            </div>
          ))}
          {!tip.pinned && n > 0 && <div className="text-text-dim">Click for clips</div>}
          {tip.pinned && n > 0 && tip.c.clips && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 self-start print:hidden"
              onClick={() => {
                const q = tip.c.clips;

                api.hide(true);
                if (q) clips.play?.(q);
              }}
            >
              <Play size={13} aria-hidden="true" /> {n} {n === 1 ? "clip" : "clips"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
