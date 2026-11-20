import type { JSX } from "react";
import { BarChart3, ChevronDown, Download, FilePlus2, Trash2, Upload } from "lucide-react";

import { Button } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { Field } from "../../ui/Field";
import { FileButton } from "../../ui/FileButton";
import { Input } from "../../ui/Input";
import { Popover } from "../../ui/Popover";
import type { MatchMeta } from "../types";
import { LOCKED_HINT } from "./locked";

type SetMenuProps = {
  meta: MatchMeta;
  hasEvents: boolean;
  /** A finished set: nothing here may change it. */
  locked: boolean;
  onMeta: (meta: Partial<MatchMeta>) => void;
  onExport: (format: "json" | "csv") => void;
  onStats: () => void;
  onStatsFromFiles: (files: File[]) => void;
  onImport: (file: File) => void;
  onNextSet: () => void;
  onClear: () => void;
};

/** The set's details and files, behind one button: its number, its stats, export and import, and the next set. */
export function SetMenu({
  meta,
  hasEvents,
  locked,
  onMeta,
  onExport,
  onStats,
  onStatsFromFiles,
  onImport,
  onNextSet,
  onClear,
}: SetMenuProps): JSX.Element {
  const lockedTitle = locked ? LOCKED_HINT : undefined;

  return (
    <Popover
      ariaLabel="Set"
      align="end"
      trigger={
        <Button variant="ghost">
          Set {meta.setNumber} <ChevronDown size={14} aria-hidden="true" />
        </Button>
      }
    >
      <div className="flex w-72 flex-col gap-3">
        <Field label="Set number" className="w-24">
          <Input
            value={meta.setNumber}
            onChange={(e) => onMeta({ setNumber: e.target.value })}
            placeholder="1"
            disabled={locked}
            title={lockedTitle}
          />
        </Field>
        <Checkbox
          ariaLabel="Detailed stats"
          checked={!!meta.detailed}
          onCheckedChange={(detailed) => onMeta({ detailed })}
          disabled={locked}
        >
          <b>Detailed stats</b>: record the kind of each attack and defense, and how the opponent dug your attacks.
        </Checkbox>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onStats} disabled={!hasEvents}>
            <BarChart3 size={15} aria-hidden="true" /> Stats and highlights for this set
          </Button>
          <FileButton
            multiple
            onFiles={onStatsFromFiles}
            title="Select the exported JSON of every set for their stats, highlight clips, and match report"
          >
            <BarChart3 size={15} aria-hidden="true" /> Stats and highlights from set files…
          </FileButton>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => onExport("json")} disabled={!hasEvents}>
              <Download size={15} aria-hidden="true" /> Export JSON
            </Button>
            <Button variant="ghost" onClick={() => onExport("csv")} disabled={!hasEvents}>
              <Download size={15} aria-hidden="true" /> Export CSV
            </Button>
            <FileButton onFiles={([file]) => onImport(file)} disabled={locked} title={lockedTitle}>
              <Upload size={15} aria-hidden="true" /> Import JSON
            </FileButton>
            <Button variant="ghost" onClick={onNextSet} disabled={!hasEvents}>
              <FilePlus2 size={15} aria-hidden="true" /> Next set
            </Button>
          </div>
          <Button variant="danger" onClick={onClear} disabled={locked} title={lockedTitle}>
            <Trash2 size={15} aria-hidden="true" /> Clear all data
          </Button>
        </div>
      </div>
    </Popover>
  );
}
