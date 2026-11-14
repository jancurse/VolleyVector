import { useState } from "react";
import type { JSX, PointerEvent as ReactPointerEvent } from "react";

import { CHART_TEXT, DASH_NOTE } from "../../ui/styles";
import type { RallyRow } from "./data";
import { linear, ticks } from "./format";
import type { TipApi } from "./tip";
import { TipBox } from "./TipBox";
import { useWidth } from "./useWidth";

/** One set's score over its rallies, ours against theirs, with the rally under the pointer marked. */
export function MiniScore({
  label,
  rows,
  maxScore,
  maxRally,
  tall,
}: {
  label: string;
  rows: readonly RallyRow[];
  maxScore: number;
  maxRally: number;
  tall: boolean;
}): JSX.Element {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = [
    { rally: 0, us: 0, them: 0 },
    ...rows.map((r) => ({ rally: r.rally, us: r.scoreUs, them: r.scoreThem })),
  ].sort((a, b) => a.rally - b.rally);
  const W = Math.max(200, width);
  const H = tall ? 240 : 150;
  const m = { t: 8, r: 34, b: 22, l: 26 };
  const x = linear(0, maxRally, m.l, W - m.r);
  const y = linear(0, maxScore, H - m.b, m.t);
  const last = pts[pts.length - 1];
  const ly = [y(last.us), y(last.them)];

  // Keep the two end labels apart when the scores are close.
  if (Math.abs(ly[0] - ly[1]) < 12) {
    const mid = (ly[0] + ly[1]) / 2;
    const dir = last.us >= last.them ? -1 : 1;

    ly[0] = mid + dir * 6;
    ly[1] = mid - dir * 6;
  }

  const line = (k: "us" | "them") => pts.map((q, i) => `${i ? "L" : "M"}${x(q.rally)},${y(q[k])}`).join("");
  const hp = hover == null ? null : pts[hover];

  const move = (e: ReactPointerEvent<SVGRectElement>, api: TipApi) => {
    const svg = e.currentTarget.ownerSVGElement?.getBoundingClientRect();

    if (!svg) return;

    const px = ((e.clientX - svg.left) * W) / svg.width;
    let best = 0;

    pts.forEach((q, i) => {
      if (Math.abs(x(q.rally) - px) < Math.abs(x(pts[best].rally) - px)) best = i;
    });
    setHover(best);
    api.show(
      e,
      { lines: [`${label}, rally ${pts[best].rally}`, `Us ${pts[best].us}, opponent ${pts[best].them}`] },
      false
    );
  };

  return (
    <TipBox className="flex min-w-0 flex-col gap-1 print:break-inside-avoid">
      {(_, api) => (
        <>
          <p className={DASH_NOTE}>{label}</p>
          <div ref={ref}>
            <svg
              className="block h-auto max-w-full"
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`${label} score progression`}
            >
              {ticks(0, maxScore, 4).map((v) => (
                <g key={v}>
                  <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="stroke-chart-grid" />
                  <text x={m.l - 4} y={y(v)} dy="0.35em" textAnchor="end" className={CHART_TEXT}>
                    {v}
                  </text>
                </g>
              ))}
              <line x1={m.l} x2={W - m.r} y1={H - m.b} y2={H - m.b} className="stroke-chart-axis" />
              {ticks(0, maxRally, 5).map((v) => (
                <text key={v} x={x(v)} y={H - m.b + 14} textAnchor="middle" className={CHART_TEXT}>
                  {v}
                </text>
              ))}
              <path
                d={line("them")}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-chart-them"
              />
              <path
                d={line("us")}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="stroke-chart-us"
              />
              <text x={x(last.rally) + 4} y={ly[0]} dy="0.35em" className="fill-text text-xs">
                {last.us}
              </text>
              <text x={x(last.rally) + 4} y={ly[1]} dy="0.35em" className={CHART_TEXT}>
                {last.them}
              </text>
              {hp && <circle r={3.5} cx={x(hp.rally)} cy={y(hp.us)} className="fill-chart-us" />}
              <rect
                x={m.l}
                y={m.t}
                width={Math.max(0, W - m.l - m.r)}
                height={H - m.t - m.b}
                fill="transparent"
                onPointerMove={(e) => move(e, api)}
                onPointerLeave={() => {
                  setHover(null);
                  api.hide(true);
                }}
              />
            </svg>
          </div>
        </>
      )}
    </TipBox>
  );
}
