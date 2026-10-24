import { useRef, useState } from "react";
import type { JSX } from "react";

import { PositionChip } from "../games/PositionChip";
import { parseRoster } from "../games/rosterImport";
import type { RosterPlayer } from "../games/types";
import type { PlayerDraft } from "../games/useRoster";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Textarea } from "../ui/Textarea";
import { cx, MUTED } from "../ui/styles";

// Add many roster players at once from pasted text or an uploaded CSV. The preview lists every line as a
// player to add or with the reason it is skipped, and nothing is saved until the coach confirms. Import
// only adds: it never changes or removes a player already on the roster.
type RosterImportDialogProps = {
  roster: readonly RosterPlayer[];
  onImport: (drafts: readonly PlayerDraft[]) => Promise<{ error: string | null }>;
  onClose: () => void;
};

export function RosterImportDialog({ roster, onImport, onClose }: RosterImportDialogProps): JSX.Element {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = parseRoster(text, roster);
  const drafts = rows.flatMap((r) => ("draft" in r ? [r.draft] : []));

  const submit = async () => {
    setSaving(true);

    const result = await onImport(drafts);

    setSaving(false);

    if (result.error) setError(result.error);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title="Import players">
      <p className="m-0 text-sm text-text-dim">
        One player per line: number, name, main position, and optionally a secondary position. Paste straight from a
        spreadsheet, or upload a CSV. Positions can be written in full or as S, OH, MB, OPP, or L.
      </p>
      <Textarea
        aria-label="Players"
        value={text}
        placeholder={"number,name,main,secondary\n7,Lena Vogt,S,OPP\n12,Mia Kraus,OH,"}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];

            if (file) setText(await file.text());
            event.target.value = "";
          }}
        />
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          Choose a file…
        </Button>
      </div>

      {rows.length > 0 && (
        <ul className="m-0 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0 text-sm">
          {rows.map((row) => (
            <li key={row.line} className="flex items-center gap-2">
              {"draft" in row ? (
                <>
                  <span className="w-6 text-right font-display font-bold tabular-nums">{row.draft.number}</span>
                  <span className="min-w-0 flex-1 truncate">{row.draft.name}</span>
                  <PositionChip position={row.draft.main} />
                  {row.draft.secondary && <PositionChip position={row.draft.secondary} secondary />}
                </>
              ) : (
                <>
                  <span className="w-6 text-right font-mono text-2xs text-text-dim">{row.line}</span>
                  <span className="min-w-0 flex-1 truncate text-text-dim">{row.text}</span>
                  <span className="flex-none text-danger">{row.error}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {rows.length > drafts.length && (
        <p className={cx(MUTED, "text-sm")}>
          {rows.length - drafts.length} {rows.length - drafts.length === 1 ? "line is" : "lines are"} skipped.
        </p>
      )}
      {error && <p className="m-0 text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" paired onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={drafts.length === 0 || saving} onClick={() => void submit()}>
          {drafts.length === 1 ? "Add 1 player" : `Add ${drafts.length} players`}
        </Button>
      </div>
    </Dialog>
  );
}
