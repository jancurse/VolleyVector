import type { GradeCount, SkillSummary } from "./data";

// Number formatting and chart scales shared by the dashboard's panels.

export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** A signed percentage, e.g. "+12%" or "−8%". */
export const eff = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + pct(Math.abs(v));

export const signed = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);

/** An action's score as its metric shows it: a count, an efficiency, or a rate. */
export const score = (r: SkillSummary): string =>
  r.score == null
    ? "—"
    : r.def?.kind === "count"
      ? String(r.score)
      : r.def?.kind === "eff"
        ? eff(r.score)
        : pct(r.score);

/** Grades from best to worst, the most common first within a level. */
export const byGrade = (a: GradeCount, b: GradeCount): number => a.level - b.level || b.n - a.n;

/** Round tick values between lo and hi, about `count` of them. */
export function ticks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];

  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(v);

  return out;
}

/** A linear scale from the domain d0–d1 to the range r0–r1. */
export const linear =
  (d0: number, d1: number, r0: number, r1: number) =>
  (v: number): number =>
    r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
