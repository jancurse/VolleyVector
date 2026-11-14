import { deriveRallies } from "./rallies";
import type { AppData, ReportSet } from "./types";

/** A set's data with its rallies derived, ready for the stats. */
export const toReportSet = (data: AppData): ReportSet => ({
  meta: data.meta,
  rallies: deriveRallies(data.events, data.meta),
});
