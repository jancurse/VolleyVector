import type { JSX } from "react";

import { ChartDisplay } from "./ChartDisplay";
import type { ChartPair } from "./reportCharts";

/** An action's outcome pie beside its zone chart. */
export function ReportChartPair({ pair }: { pair: ChartPair }): JSX.Element | null {
  if (!pair.pie && !pair.zones) return null;

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[var(--container-report-pie)_minmax(0,1fr)]">
      {pair.pie && <ChartDisplay chart={pair.pie} title={`${pair.title}: outcomes`} />}
      {pair.zones && <ChartDisplay chart={pair.zones} title={`${pair.title} by zone`} />}
    </div>
  );
}
