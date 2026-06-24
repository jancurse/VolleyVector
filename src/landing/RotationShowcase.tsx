import { cubicBezier, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { MousePointer2, Pencil } from "lucide-react";

import { rotationAssignment, rotationLinks, rotationViolations } from "../boards/rotation";
import type { Board } from "../boards/types";
import { Court } from "../court/Court";
import { toSvgPoint, VIEW_SIZE } from "../court/geometry";
import type { NormalizedPoint } from "../court/geometry";
import { EASE_SETTLE } from "../court/motion";
import { DescriptionPanel, RotationViewPanel } from "../editor/BoardView";
import { DescriptionEditor } from "../editor/DescriptionEditor";
import { RotationPanel } from "../editor/RotationPanel";
import { Button } from "../ui/Button";
import { CourtFrame } from "../ui/CourtFrame";
import { Input } from "../ui/Input";
import { cx, EYEBROW, TITLE, VIEW_BODY } from "../ui/styles";
import { usePrefersReducedMotion } from "../court/usePrefersReducedMotion";
import { ROTATION_REST_INDEX } from "./exampleBoards";
import type { RotationBeat } from "./exampleBoards";

// The rotation beat: a coach editing one board through the app's own surfaces, narrated by a simulated
// pointer. The real view header and editor (title field, RotationPanel, description) are driven as a
// still from ROTATION_SCRIPT; the pointer glides between them, clicks Edit and Done, and rides each
// dragged player. The overlap overlay and faults recompute every frame off the live positions, so the
// blue cue edges and red overlaps are the app's own, never authored here.

// The app's shared settle curve, so a move's glide matches the rest of the app's motion.
const ease = cubicBezier(...EASE_SETTLE);

// The pointer's glide toward its target, as a smoothing time constant (ms): brisk while travelling to a
// control, near-instant while gripping a dragged player so it stays under the disc.
const TAU_MOVE = 150;
const TAU_GRAB = 55;

// The soft accent ring on the field the coach is mid-typing, the visual cue of what is changing.
const FIELD_GLOW = "ring-2 ring-accent/55 ring-offset-2 ring-offset-bg";

const noop = () => {};

const lerp = (a: NormalizedPoint, b: NormalizedPoint, t: number): NormalizedPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

function interpolate(
  from: Record<string, NormalizedPoint>,
  to: Record<string, NormalizedPoint>,
  t: number
): Record<string, NormalizedPoint> {
  const out: Record<string, NormalizedPoint> = {};

  for (const id of Object.keys(to)) out[id] = from[id] ? lerp(from[id], to[id], t) : to[id];

  return out;
}

// Text the coach is mid-typing: the previous text deletes over the first 40%, a brief blank, then the
// new text types in over the rest — a select-all-and-retype, the way a coach renames a field.
function typeOut(from: string, to: string, t: number): string {
  if (t < 0.4) return from.slice(0, Math.ceil(from.length * (1 - t / 0.4)));
  if (t < 0.5) return "";

  return to.slice(0, Math.round(to.length * ((t - 0.5) / 0.5)));
}

type Point = { x: number; y: number };

// The simulated coach pointer: a cursor glyph that travels the surface. `press` flashes a click ring
// (Edit/Done), `grab` shrinks it to read as holding a dragged player.
function Cursor({ at, press, grab }: { at: Point; press: boolean; grab: boolean }): JSX.Element {
  return (
    <div
      className="absolute left-0 top-0 will-change-transform"
      style={{ transform: `translate3d(${at.x}px, ${at.y}px, 0)` }}
    >
      <div className={cx("relative transition-transform duration-150 ease-settle", grab && "scale-[0.82]")}>
        <MousePointer2
          size={28}
          className="text-white"
          fill="white"
          stroke="#0f172a"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 2px 4px rgba(15,23,42,0.4))" }}
        />
        {press && (
          <span className="absolute left-[3px] top-[3px] size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent opacity-70 animate-ping" />
        )}
        {grab && (
          <span className="absolute left-[3px] top-[3px] size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/25" />
        )}
      </div>
    </div>
  );
}

type Frame = {
  positions: Record<string, NormalizedPoint>;
  index: number;
  local: number;
  cursor: Point | null;
  selected: string | null;
};

// How near the pointer must be to a tapped player, as a fraction of the court width, before its
// selection (and its overlap edges) light up — so the blue lines appear as the pointer lands on the
// disc, not while it is still travelling there.
const TAP_RADIUS = 0.08;

export function RotationShowcase({ board, script }: { board: Board; script: readonly RotationBeat[] }): JSX.Element {
  const reduced = usePrefersReducedMotion();

  // Each beat's start time, by summing the durations before it; the loop length is the last end.
  const offsets = useMemo(() => script.map((_, i) => script.slice(0, i).reduce((sum, b) => sum + b.ms, 0)), [script]);
  const total = useMemo(() => script.reduce((sum, beat) => sum + beat.ms, 0), [script]);

  const containerRef = useRef<HTMLDivElement>(null);
  const courtRef = useRef<HTMLElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);

  const [frame, setFrame] = useState<Frame>(() => ({
    positions: script[0].positions,
    index: 0,
    local: 0,
    cursor: null,
    selected: null,
  }));

  // Resolve a beat's cursor target to a pixel point in the container, measured live so it tracks
  // resizing and the board's responsive layout: a UI anchor's centre, a marker's court position, or
  // just off the bottom edge (`park`). Reads only stable refs, so the rAF loop holds one instance.
  const resolveTarget = useCallback((cursor: string, positions: Record<string, NormalizedPoint>): Point | null => {
    const container = containerRef.current;

    if (!container) return null;

    const c = container.getBoundingClientRect();
    const centre = (el: Element | null): Point | null => {
      if (!el) return null;

      const r = el.getBoundingClientRect();

      return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
    };

    if (cursor === "park") return { x: c.width * 0.5, y: c.height + 56 };
    if (cursor === "edit") return centre(editRef.current);
    if (cursor === "done") return centre(doneRef.current);
    if (cursor === "title") return centre(titleRef.current);

    if (cursor === "desc") {
      const el = descRef.current;

      if (!el) return null;

      const r = el.getBoundingClientRect();

      return { x: r.left - c.left + Math.min(r.width * 0.5, 130), y: r.top - c.top + 64 };
    }

    const fig = courtRef.current;
    const point = positions[cursor];

    if (!fig || !point) return null;

    const r = fig.getBoundingClientRect();
    const s = toSvgPoint(point);

    return { x: r.left - c.left + (s.x / VIEW_SIZE) * r.width, y: r.top - c.top + (s.y / VIEW_SIZE) * r.height };
  }, []);

  useEffect(() => {
    if (reduced) return;

    let raf = 0;
    let start: number | null = null;
    let prev: number | null = null;
    let cursor: Point | null = null;

    const tick = (now: number) => {
      start ??= now;

      const elapsed = (now - start) % total;

      let i = offsets.length - 1;

      while (i > 0 && elapsed < offsets[i]) i--;

      const beat = script[i];
      const local = Math.min(1, (elapsed - offsets[i]) / beat.ms);
      const from = script[(i - 1 + script.length) % script.length];
      const positions = beat.move ? interpolate(from.positions, beat.positions, ease(local)) : beat.positions;

      const target = resolveTarget(beat.cursor, positions);

      if (target) {
        if (!cursor) cursor = target;
        else {
          const dt = Math.min(64, prev === null ? 16 : now - prev);
          const k = 1 - Math.exp(-dt / (beat.grab ? TAU_GRAB : TAU_MOVE));

          cursor = { x: cursor.x + (target.x - cursor.x) * k, y: cursor.y + (target.y - cursor.y) * k };
        }
      }

      // A tapped player lights only once the pointer is gripping it (a drag) or has landed on its
      // disc, so the cue edges follow the click rather than leading it.
      let selected: string | null = null;

      if (beat.selectedId) {
        if (beat.grab) selected = beat.selectedId;
        else {
          const markerPoint = resolveTarget(beat.selectedId, positions);
          const width = courtRef.current?.getBoundingClientRect().width ?? 0;

          if (cursor && markerPoint && width > 0) {
            const distance = Math.hypot(cursor.x - markerPoint.x, cursor.y - markerPoint.y);

            if (distance < width * TAP_RADIUS) selected = beat.selectedId;
          }
        }
      }

      prev = now;
      setFrame({ positions, index: i, local, cursor: cursor ? { ...cursor } : null, selected });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [reduced, script, offsets, total, resolveTarget]);

  // Reduced motion rests on the one overlap still: the setter tapped, the red edge and fault showing.
  const active: Frame = reduced
    ? {
        positions: script[ROTATION_REST_INDEX].positions,
        index: ROTATION_REST_INDEX,
        local: 1,
        cursor: null,
        selected: script[ROTATION_REST_INDEX].selectedId,
      }
    : frame;
  const beat = script[active.index];
  const positions = active.positions;
  const prevBeat = script[(active.index - 1 + script.length) % script.length];
  const selectedId = active.selected;

  const rotation = board.steps[0].rotation;
  const assignment = useMemo(() => rotationAssignment(board.markers, rotation), [board.markers, rotation]);
  const markers = board.markers.map((m) => ({ ...m, position: positions[m.id] }));
  const violations = assignment ? rotationViolations(assignment, positions, board.markers) : [];
  const overlay = assignment ? rotationLinks(assignment, violations, selectedId) : undefined;

  // What the editor fields show: settled, or mid-rename typed out from the previous beat's text with a
  // trailing caret. The live draft feeds the real rotation panel and view card.
  const titleText = beat.titleTyping ? typeOut(prevBeat.title, beat.title, active.local) : beat.title;
  const descText = beat.descTyping ? typeOut(prevBeat.description, beat.description, active.local) : beat.description;
  const draft: Board = {
    ...board,
    title: beat.title,
    description: beat.description,
    steps: [{ ...board.steps[0], positions }],
  };

  const editing = beat.mode === "edit";
  const pressEdit = beat.cursor === "edit" && beat.press === true && active.local < 0.6;
  const pressDone = beat.cursor === "done" && beat.press === true && active.local < 0.6;

  return (
    <MotionConfig reducedMotion="user">
      <div ref={containerRef} className="relative flex w-full flex-col items-center gap-[clamp(1.25rem,3vw,2rem)]">
        {/* The app's real surfaces: the read-only view (eyebrow, title, Edit) swapping to the editor
            (title field, Done, rotation card, description), driven as a still so the beat reads as a
            coach opening a board and editing it rather than a finished diagram. */}
        <div className="flex w-full flex-col gap-[clamp(0.85rem,2vw,1.25rem)] text-left">
          <div className="flex min-h-[3rem] items-center justify-between gap-3" aria-hidden="true">
            {editing ? (
              <>
                <div
                  ref={titleRef}
                  className={cx(
                    "min-w-0 flex-1 rounded-lg px-1 transition-shadow duration-200",
                    beat.titleTyping && FIELD_GLOW
                  )}
                >
                  <Input
                    variant="title"
                    value={beat.titleTyping ? `${titleText}│` : titleText}
                    readOnly
                    tabIndex={-1}
                    aria-label="Board title"
                  />
                </div>
                <Button
                  ref={doneRef}
                  variant="primary"
                  className={cx(
                    "pointer-events-none flex-none transition-transform",
                    pressDone && "scale-95 ring-2 ring-accent ring-offset-2 ring-offset-bg"
                  )}
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <p className={EYEBROW}>Position</p>
                  <h3 className={cx(TITLE, "truncate")}>{beat.title}</h3>
                </div>
                <Button
                  ref={editRef}
                  variant="primary"
                  className={cx(
                    "pointer-events-none flex-none gap-1.5 transition-transform",
                    pressEdit && "scale-95 ring-2 ring-accent ring-offset-2 ring-offset-bg"
                  )}
                >
                  <Pencil size={15} aria-hidden="true" />
                  Edit
                </Button>
              </>
            )}
          </div>

          <div className={cx(VIEW_BODY, "w-full")}>
            <CourtFrame ref={courtRef} className="max-court:order-2 max-court:justify-self-center">
              <Court markers={markers} rotation={overlay} selectedId={selectedId} label={beat.title} />
            </CourtFrame>
            <div
              className={cx(
                "flex flex-col-reverse gap-4 max-court:order-1 max-court:flex-row max-court:flex-wrap max-court:items-stretch",
                editing && "pointer-events-none"
              )}
              aria-hidden="true"
            >
              <div className="grid min-w-0 max-court:flex-1 max-court:min-w-[16rem]">
                {editing ? (
                  <div
                    ref={descRef}
                    className={cx("grid rounded-xl transition-shadow duration-200", beat.descTyping && FIELD_GLOW)}
                  >
                    <DescriptionEditor value={beat.descTyping ? `${descText}│` : descText} onChange={noop} compact />
                  </div>
                ) : (
                  <DescriptionPanel markdown={beat.description} />
                )}
              </div>
              <div className="grid max-court:max-w-[17rem]">
                {editing ? (
                  <RotationPanel
                    draft={draft}
                    stepIndex={0}
                    violations={violations}
                    selectedId={selectedId}
                    links={overlay?.links}
                    onChangeRotation={noop}
                    onPlace={noop}
                    onChangeStrict={noop}
                  />
                ) : (
                  rotation &&
                  overlay && (
                    <RotationViewPanel
                      board={draft}
                      rotation={rotation}
                      violations={violations}
                      selectedId={selectedId}
                      links={overlay.links}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        {/* The coach's pointer, above the surfaces, clipped as it parks off the bottom edge. */}
        {!reduced && active.cursor && (
          <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden" aria-hidden="true">
            <Cursor at={active.cursor} press={beat.press === true && active.local < 0.6} grab={beat.grab === true} />
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
