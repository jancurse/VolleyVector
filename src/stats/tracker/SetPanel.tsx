import type { JSX } from "react";
import { BarChart3, CheckCircle2, Download, FilePlus2, RotateCcw, Trash2, Upload } from "lucide-react";

import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { PANEL, PANEL_TITLE } from "../../ui/styles";
import type { MatchMeta } from "../types";
import { FileButton } from "../../ui/FileButton";

type SetPanelProps = {
  meta: MatchMeta;
  hasEvents: boolean;
  finished: boolean;
  onMeta: (meta: Partial<MatchMeta>) => void;
  onExport: (format: "json" | "csv") => void;
  onStats: () => void;
  onImport: (file: File) => void;
  onStatsFromFiles: (files: File[]) => void;
  onNextSet: () => void;
  onFinish: (finished: boolean) => void;
  onClear: () => void;
};

/**
 * The set's own details and actions. The teams and date belong to the game (edited on its page); only the
 * set number is per set.
 */
export function SetPanel({
  meta,
  hasEvents,
  finished,
  onMeta,
  onExport,
  onStats,
  onImport,
  onStatsFromFiles,
  onNextSet,
  onFinish,
  onClear,
}: SetPanelProps): JSX.Element {
  return (
    <section className={PANEL} aria-labelledby="set-title">
      <h2 id="set-title" className={PANEL_TITLE}>
        Set
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Home">
          <Input value={meta.homeTeam} readOnly title="Change this on the game page" />
        </Field>
        <Field label="Away">
          <Input value={meta.awayTeam} readOnly title="Change this on the game page" />
        </Field>
        <Field label="Set">
          <Input value={meta.setNumber} onChange={(e) => onMeta({ setNumber: e.target.value })} placeholder="1" />
        </Field>
        <Field label="Date">
          <Input type="date" value={meta.date} readOnly title="Change this on the game page" />
        </Field>
      </div>

      <Button variant="ghost" paired onClick={onStats} disabled={!hasEvents}>
        <BarChart3 size={15} aria-hidden="true" /> Stats and highlights for this set
      </Button>
      <FileButton
        multiple
        paired
        onFiles={onStatsFromFiles}
        title="Select the exported JSON of every set for their stats, highlight clips, and match report"
      >
        <BarChart3 size={15} aria-hidden="true" /> Stats and highlights from set files…
      </FileButton>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" paired onClick={() => onExport("json")} disabled={!hasEvents}>
          <Download size={15} aria-hidden="true" /> Export JSON
        </Button>
        <Button variant="ghost" paired onClick={() => onExport("csv")} disabled={!hasEvents}>
          <Download size={15} aria-hidden="true" /> Export CSV
        </Button>
        <FileButton paired onFiles={([file]) => onImport(file)}>
          <Upload size={15} aria-hidden="true" /> Import JSON
        </FileButton>
        <Button variant="ghost" paired onClick={onNextSet} disabled={!hasEvents}>
          <FilePlus2 size={15} aria-hidden="true" /> Next set
        </Button>
      </div>
      <Button variant="ghost" paired onClick={() => onFinish(!finished)} disabled={!hasEvents}>
        {finished ? (
          <>
            <RotateCcw size={15} aria-hidden="true" /> Reopen set
          </>
        ) : (
          <>
            <CheckCircle2 size={15} aria-hidden="true" /> Mark set finished
          </>
        )}
      </Button>
      <Button variant="danger" onClick={onClear}>
        <Trash2 size={15} aria-hidden="true" /> Clear all data
      </Button>
    </section>
  );
}
