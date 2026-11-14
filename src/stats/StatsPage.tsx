import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { JSX } from "react";
import { ArrowLeft, BarChart3, Clapperboard, FileDown, FileText, Printer } from "lucide-react";

import { Button } from "../ui/Button";
import { Tab, TabList, Tabs } from "../ui/Tabs";
import { CALLOUT_WARN, EYEBROW, HL_PANE, MUTED, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { emptySelection } from "./clips";
import type { Selection } from "./clips";
import StatsDashboard from "./dashboard/StatsDashboard";
import type { Params } from "./dashboard/params";
import { download } from "../bundle/download";
import type { ReportSet } from "./types";

// Highlights loads YouTube, and the report Chart.js and jsPDF, so each loads when first shown.
const Highlights = lazy(() => import("./highlights/Highlights"));
const StatsReport = lazy(() => import("./report/StatsReport"));

export type StatsTab = "stats" | "highlights" | "report";

type StatsPageProps = {
  sets: readonly ReportSet[];
  /** What the sets belong to, above the title, e.g. the team. */
  eyebrow: string;
  title: string;
  initialTab: StatsTab;
  /** Called when the stats or report tab is picked, so the URL follows. */
  onTab?: (tab: StatsTab) => void;
  /** A back button, for the stats opened from inside the tracker. */
  back?: { label: string; onBack: () => void };
};

const loading = <p className={MUTED}>Loading…</p>;

/**
 * Recorded sets as stats, highlights, and the match report, in three tabs. The stats and highlights stay
 * mounted once shown, so each keeps its filters and scroll, and a tap on a stat opens the highlights filtered to
 * those moments.
 */
export function StatsPage({ sets, eyebrow, title, initialTab, onTab, back }: StatsPageProps): JSX.Element {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  const [opened, setOpened] = useState<ReadonlySet<StatsTab>>(() => new Set([initialTab]));
  const [selection, setSelection] = useState(emptySelection);
  // The dashboard's current filters and rally log view, so its exports open (and print) as seen.
  const params = useRef<Params | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);

  const exporting = (run: () => Promise<void>) => {
    setExportError(null);
    run().catch((e: unknown) =>
      setExportError(`Couldn’t export the stats: ${e instanceof Error ? e.message : String(e)}`)
    );
  };

  const show = (next: StatsTab) => {
    setOpened((o) => new Set([...o, next]));
    setTab(next);
    if (next !== "highlights") onTab?.(next);
  };

  const playClips = useCallback((s: Partial<Selection>) => {
    setSelection({ ...emptySelection(), ...s });
    setOpened((o) => new Set([...o, "highlights"]));
    setTab("highlights");
  }, []);

  const onParams = useCallback((p: Params) => {
    params.current = p;
  }, []);

  const exportHtml = async () => {
    const { dashboardHtml, dashboardFilename } = await import("./dashboard/export");

    download(await dashboardHtml([...sets], params.current), dashboardFilename([...sets]), "text/html");
  };

  // Prints the exported page from a hidden frame, so the print dialog saves just the stats as PDF, with no
  // pop-up blocker in the way.
  const exportPdf = async () => {
    const { dashboardHtml, dashboardTitle } = await import("./dashboard/export");
    const frame = document.createElement("iframe");

    frame.className = "fixed top-0 right-full h-screen w-screen border-0";
    frame.srcdoc = await dashboardHtml([...sets], params.current);
    frame.onload = () =>
      // Give the charts a moment to measure and draw.
      setTimeout(() => {
        // Browsers name the PDF after the page title.
        const pageTitle = document.title;

        document.title = dashboardTitle([...sets]);
        frame.contentWindow?.print();
        document.title = pageTitle;
        frame.remove();
      }, 500);
    document.body.append(frame);
  };

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div className="flex min-w-0 flex-col">
          {back && (
            <Button variant="text" className="mb-2 self-start pl-0" onClick={back.onBack}>
              <ArrowLeft size={15} aria-hidden="true" /> {back.label}
            </Button>
          )}
          <p className={EYEBROW}>{eyebrow}</p>
          <h1 className={TITLE}>{title}</h1>
        </div>
        {tab === "stats" && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => exporting(exportHtml)}
              title="Download the stats as one HTML file that works offline"
            >
              <FileDown size={15} aria-hidden="true" /> HTML
            </Button>
            <Button variant="ghost" onClick={() => exporting(exportPdf)} title="Print the stats or save them as PDF">
              <Printer size={15} aria-hidden="true" /> PDF
            </Button>
          </div>
        )}
      </div>

      {exportError && <p className={CALLOUT_WARN}>{exportError}</p>}

      <Tabs value={tab} onValueChange={(v) => show(v === "highlights" || v === "report" ? v : "stats")}>
        <TabList ariaLabel="View">
          <Tab value="stats">
            <span className="flex items-center gap-1.5">
              <BarChart3 size={15} aria-hidden="true" /> Stats
            </span>
          </Tab>
          <Tab value="highlights">
            <span className="flex items-center gap-1.5">
              <Clapperboard size={15} aria-hidden="true" /> Highlights
            </span>
          </Tab>
          <Tab value="report">
            <span className="flex items-center gap-1.5">
              <FileText size={15} aria-hidden="true" /> Match report
            </span>
          </Tab>
        </TabList>
      </Tabs>

      {opened.has("stats") && (
        <div hidden={tab !== "stats"}>
          <StatsDashboard sets={sets} onClips={playClips} onParams={onParams} />
        </div>
      )}
      {opened.has("highlights") && (
        <div hidden={tab !== "highlights"} className={HL_PANE}>
          <Suspense fallback={loading}>
            <Highlights sets={sets} selection={selection} onSelection={setSelection} active={tab === "highlights"} />
          </Suspense>
        </div>
      )}
      {tab === "report" && (
        <Suspense fallback={loading}>
          <StatsReport sets={sets} />
        </Suspense>
      )}
    </section>
  );
}
