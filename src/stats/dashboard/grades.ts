import { cx, GRADE_FILL, SWATCH } from "../../ui/styles";
import type { GradeCount } from "./data";
import type { LegendItem } from "./Legend";

/** The fill of grade `i` of an action, later grades of the same level dimmed. */
export const gradeClass = (grades: readonly GradeCount[], i: number): string =>
  cx(GRADE_FILL[grades[i].level] ?? GRADE_FILL[2], i > 0 && grades[i - 1].level === grades[i].level && "opacity-55");

/** A legend for an action's grades, in order. */
export const gradeKey = (grades: readonly GradeCount[]): LegendItem[] =>
  grades.map((g, i) => ({ swatch: cx(SWATCH, gradeClass(grades, i)), label: g.grade }));
