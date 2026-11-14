import { memo, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { Download } from "lucide-react";

import { Button } from "../../ui/Button";
import { CALLOUT_WARN, DASH_CARD, DASH_HEADING, DASH_NOTE, EYEBROW } from "../../ui/styles";
import { formatGameDate, formatWhen } from "../../games/format";
import type { ReportSet } from "../types";
import { ChartDisplay } from "./ChartDisplay";
import { ReportChartPair } from "./ReportChartPair";
import { reportCharts } from "./reportCharts";
import { downloadReportHtml, downloadReportPdf } from "./reportExport";
import { ReportLinks } from "./ReportLinks";
import { matchSummary, reportTitle, setLabel } from "./statsAnalyzer";
import { ExternalLink } from "../../ui/ExternalLink";

type StatsReportProps = {
  /** One set for a set report; several for a whole-match report. */
  sets: readonly ReportSet[];
};

/**
 * The set and match report: each action's outcomes and zones, outcomes per player, the score over each set,
 * the opponent's errors, and every moment as a YouTube link. It sits on light paper, as the app's handouts do,
 * and downloads as a PDF or an HTML file that look the same.
 */
function StatsReport({ sets }: StatsReportProps): JSX.Element {
  const paperRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "html" | null>(null);
  const multi = sets.length > 1;
  // Memoised: the tracker re-renders several times a second while video plays.
  const charts = useMemo(() => reportCharts(sets), [sets]);
  const title = reportTitle([...sets]);
  const { scores, setsWon } = matchSummary([...sets]);
  const { homeTeam, awayTeam, date } = sets[0]?.meta ?? { homeTeam: "", awayTeam: "", date: "" };
  const heading = [homeTeam, awayTeam].filter(Boolean).join(" vs ") || "Match report";
  const result = multi
    ? `Sets ${setsWon[0]}–${setsWon[1]}: ${sets.map((s, i) => `${setLabel(s, i)} ${scores[i][0]}–${scores[i][1]}`).join(", ")}.`
    : `${setLabel(sets[0], 0)}, ${scores[0][0]}–${scores[0][1]}.`;
  const videos = sets.map((s, i) => ({ label: setLabel(s, i), url: s.meta.youtubeUrl })).filter((v) => v.url);
  const fileName = `volleyball_stats_report_${multi ? "match_" : ""}${sets[0]?.meta.date || "report"}`;

  const run = async (what: "pdf" | "html") => {
    const paper = paperRef.current;

    if (!paper) return;

    setBusy(what);
    setError(null);

    try {
      if (what === "pdf") await downloadReportPdf(paper, fileName);
      else await downloadReportHtml(paper, title, fileName);
    } catch (e) {
      setError(
        `Couldn’t make the ${what === "pdf" ? "PDF" : "HTML file"}: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={paperRef} className="flex flex-col gap-4">
      <header className={DASH_CARD} data-report-section>
        <p className={EYEBROW}>Match report</p>
        <h2 className={DASH_HEADING}>{heading}</h2>
        <p className="m-0 text-base">
          {date && `${formatGameDate(date)}. `}
          {result}
        </p>
        {videos.map((v) => (
          <p key={v.label} className={DASH_NOTE}>
            {multi && `${v.label}: `}
            <ExternalLink href={v.url} className="break-all">
              {v.url}
            </ExternalLink>
          </p>
        ))}
      </header>

      {charts.pairs.map((pair) => (
        <div key={pair.key} data-report-section>
          <ReportChartPair pair={pair} />
        </div>
      ))}

      {charts.perPlayer.map(
        ({ key, title: chartTitle, chart }) =>
          chart && (
            <div key={key} data-report-section>
              <ChartDisplay chart={chart} title={chartTitle} />
            </div>
          )
      )}

      {charts.scores.map(
        ({ label, chart }) =>
          chart && (
            <div key={label} data-report-section>
              <ChartDisplay chart={chart} title={multi ? `Score progression, ${label}` : "Score progression"} />
            </div>
          )
      )}

      {charts.opponentErrors && (
        <div data-report-section className="flex flex-col gap-2">
          <ChartDisplay chart={charts.opponentErrors} title="Opponent errors" />
          <p className="m-0 text-center text-text-dim">
            Points given to us by opponent errors: {charts.totalOpponentErrors}
          </p>
        </div>
      )}

      <ReportLinks sets={sets} />

      <footer
        className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
        data-report-download
      >
        <p className={DASH_NOTE}>Made on {formatWhen(new Date().toISOString())}</p>
        {error && <p className={CALLOUT_WARN}>{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" paired onClick={() => void run("html")} disabled={!!busy}>
            <Download size={15} aria-hidden="true" /> {busy === "html" ? "Making the file…" : "Download HTML"}
          </Button>
          <Button onClick={() => void run("pdf")} disabled={!!busy}>
            <Download size={15} aria-hidden="true" /> {busy === "pdf" ? "Making the PDF…" : "Download PDF"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default memo(StatsReport);
