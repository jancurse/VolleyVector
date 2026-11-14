import type { JSX } from "react";

import { CHART_TEXT, MUTED } from "../../ui/styles";
import { POINT_TYPES } from "./data";
import { linear } from "./format";
import { TipBox } from "./TipBox";
import { useWidth } from "./useWidth";

/** How the points were won, theirs to the left and ours to the right of each kind's label. */
export function PointBreakdown({
  rows: types,
}: {
  rows: readonly { type: string; us: number; them: number }[];
}): JSX.Element {
  const [ref, width] = useWidth<HTMLDivElement>();
  const order = POINT_TYPES as readonly string[];
  const sorted = [...types].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const rows = [
    { type: "Total", us: sorted.reduce((a, r) => a + r.us, 0), them: sorted.reduce((a, r) => a + r.them, 0) },
    ...sorted,
  ];
  const W = Math.max(280, width);
  const rowH = 30;
  const top = 18;
  const H = top + rows.length * rowH + 4;
  const mid = W / 2;
  const lab = (Math.max(...rows.map((r) => r.type.length)) * 6.8) / 2 + 10;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.us, r.them)));
  const x = linear(0, max, 0, Math.max(10, mid - lab - String(max).length * 9 - 8));

  return (
    <TipBox>
      {(_, api) => (
        <div ref={ref}>
          {sorted.length ? (
            <svg
              className="block h-auto max-w-full"
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Point breakdown"
            >
              <text x={mid - lab} y={12} textAnchor="end" className={CHART_TEXT}>
                Opponent
              </text>
              <text x={mid + lab} y={12} className={CHART_TEXT}>
                Us
              </text>
              {rows.map((r, i) => (
                <g
                  key={r.type}
                  transform={`translate(0,${top + i * rowH})`}
                  onPointerMove={(e) => api.show(e, { lines: [r.type, `Us ${r.us}, opponent ${r.them}`] }, false)}
                  onPointerLeave={() => api.hide(true)}
                >
                  <rect width={W} height={rowH} fill="transparent" />
                  {i === 1 && <line x1={0} x2={W} y1={1} y2={1} className="stroke-chart-grid" />}
                  <text
                    x={mid}
                    y={rowH / 2}
                    dy="0.35em"
                    textAnchor="middle"
                    className={r.type === "Total" ? "fill-text text-xs font-semibold" : "fill-text text-xs"}
                  >
                    {r.type}
                  </text>
                  <rect
                    x={mid - lab - x(r.them)}
                    y={6}
                    height={rowH - 12}
                    width={x(r.them)}
                    rx={2}
                    className="fill-chart-them"
                  />
                  <rect x={mid + lab} y={6} height={rowH - 12} width={x(r.us)} rx={2} className="fill-chart-us" />
                  <text x={mid - lab - x(r.them) - 4} y={rowH / 2} dy="0.35em" textAnchor="end" className={CHART_TEXT}>
                    {r.them}
                  </text>
                  <text x={mid + lab + x(r.us) + 4} y={rowH / 2} dy="0.35em" className={CHART_TEXT}>
                    {r.us}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <p className={MUTED}>No points.</p>
          )}
        </div>
      )}
    </TipBox>
  );
}
