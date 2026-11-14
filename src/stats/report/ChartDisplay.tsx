import { useEffect, useRef } from "react";
import type { JSX } from "react";

import { useThemeVersion } from "../../theme/useThemeVersion";
import { cx, DASH_CARD, DASH_CARD_TITLE } from "../../ui/styles";
import type { CanvasChart } from "./chartGenerator";
import { drawChart } from "./drawChart";

/** Each drawn chart, by its canvas, so a download can draw it again in the light theme. */
export const chartsByCanvas = new WeakMap<HTMLCanvasElement, CanvasChart>();

type ChartDisplayProps = {
  chart: CanvasChart;
  title: string;
};

/** One chart of the report in a card, drawn in the page's theme. */
export function ChartDisplay({ chart, title }: ChartDisplayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useThemeVersion();
  // Courts and pies are square (a pie's key beside it needs the height for up to eight outcomes); every other
  // chart is wide.
  const shape =
    chart.type === "custom" || chart.type === "doughnut"
      ? "aspect-square max-w-report-chart-sm"
      : "aspect-report-wide max-w-report-chart";

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    chartsByCanvas.set(canvas, chart);

    return drawChart(canvas, chart);
  }, [chart, theme]);

  return (
    <section aria-label={title} className={DASH_CARD}>
      <h3 className={DASH_CARD_TITLE}>{title}</h3>
      <div className={cx("relative mx-auto w-full", shape)}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full!" />
      </div>
    </section>
  );
}
