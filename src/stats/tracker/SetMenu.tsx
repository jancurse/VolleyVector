import { useRef } from "react";
import type { ChangeEvent, JSX } from "react";
import { Ellipsis } from "lucide-react";

import { IconButton } from "../../ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "../../ui/Menu";
import type { MatchMeta } from "../types";

type SetMenuProps = {
  meta: MatchMeta;
  hasEvents: boolean;
  /** A locked set: nothing here may change it. */
  locked: boolean;
  onMeta: (meta: Partial<MatchMeta>) => void;
  onExport: (format: "json" | "csv") => void;
  onStats: () => void;
  onStatsFromFiles: (files: File[]) => void;
  onImport: (file: File) => void;
  onNextSet: () => void;
  onClear: () => void;
  /** Open the dialog that has a model draft the set from its video. */
  onAi: () => void;
};

/** The set's own actions in one menu: its stats, export and import, detailed stats, the next set, and clearing it. */
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
  onAi,
}: SetMenuProps): JSX.Element {
  const statsFiles = useRef<HTMLInputElement>(null);
  const importFile = useRef<HTMLInputElement>(null);
  const picked = (onFiles: (files: File[]) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);

    if (files.length) onFiles(files);
    e.target.value = "";
  };

  return (
    <>
      <Menu
        tooltip="More actions"
        trigger={
          <IconButton variant="plain" size="sm" aria-label="Set actions">
            <Ellipsis size={16} aria-hidden="true" />
          </IconButton>
        }
      >
        <MenuItem onClick={onStats} disabled={!hasEvents}>
          Stats and highlights for this set
        </MenuItem>
        <MenuItem onClick={() => statsFiles.current?.click()}>Stats and highlights from set files…</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => onExport("json")} disabled={!hasEvents}>
          Export JSON
        </MenuItem>
        <MenuItem onClick={() => onExport("csv")} disabled={!hasEvents}>
          Export CSV
        </MenuItem>
        <MenuItem onClick={() => importFile.current?.click()} disabled={locked}>
          Import JSON…
        </MenuItem>
        <MenuItem onClick={onAi} disabled={locked}>
          Draft with AI…
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => onMeta({ detailed: !meta.detailed || undefined })} disabled={locked}>
          {meta.detailed ? "Turn off detailed stats" : "Turn on detailed stats"}
        </MenuItem>
        <MenuItem onClick={onNextSet} disabled={!hasEvents}>
          Next set
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onClear} disabled={locked}>
          Clear all data
        </MenuItem>
      </Menu>
      <input
        ref={statsFiles}
        type="file"
        accept="application/json,.json"
        multiple
        hidden
        onChange={picked(onStatsFromFiles)}
      />
      <input
        ref={importFile}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={picked(([file]) => onImport(file))}
      />
    </>
  );
}
