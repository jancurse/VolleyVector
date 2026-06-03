import type { JSX } from "react";

import { ATTACK_LINE, COURT_SPAN, toSvg, VIEW_SIZE } from "./geometry";
import { Marker } from "./Marker";
import type { Marker as MarkerData } from "./types";

// The single court component, shared by static tactics and individual drill steps. It draws the
// playing surface, its lines, the net, and the given markers — and nothing about interaction or
// animation lives here, so both modes render identically from the same inputs.

const NET_BAND = 54; // height of the net mesh above the top line, in SVG units
const NET_STRANDS = 26;

const left = toSvg(0);
const right = toSvg(1);
const netLine = toSvg(0);
const netTape = netLine - NET_BAND;

type CourtProps = {
  markers: readonly MarkerData[];
  /** Accessible name for the whole diagram. */
  label?: string;
};

export function Court({ markers, label = "Volleyball half-court" }: CourtProps): JSX.Element {
  return (
    <svg className="vc-court" viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`} aria-label={label}>
      <rect className="vc-play" x={left} y={toSvg(0)} width={COURT_SPAN} height={COURT_SPAN} rx={4} />
      <rect className="vc-zone" x={left} y={toSvg(0)} width={COURT_SPAN} height={ATTACK_LINE * COURT_SPAN} />

      <rect className="vc-boundary" x={left} y={toSvg(0)} width={COURT_SPAN} height={COURT_SPAN} rx={4} />
      <line className="vc-attack" x1={left} y1={toSvg(ATTACK_LINE)} x2={right} y2={toSvg(ATTACK_LINE)} />

      <g className="vc-net" aria-hidden="true">
        <line className="vc-net-tape" x1={left} y1={netTape} x2={right} y2={netTape} />
        {Array.from({ length: NET_STRANDS + 1 }, (_, i) => {
          const x = toSvg(i / NET_STRANDS);

          return <line key={i} className="vc-net-strand" x1={x} y1={netTape} x2={x} y2={netLine} />;
        })}
        <line className="vc-net-post" x1={left} y1={netTape - 14} x2={left} y2={netLine} />
        <line className="vc-net-post" x1={right} y1={netTape - 14} x2={right} y2={netLine} />
      </g>

      {markers.map((marker, i) => (
        <Marker key={marker.id} marker={marker} index={i} />
      ))}
    </svg>
  );
}
