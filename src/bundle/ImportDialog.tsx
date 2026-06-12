import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import type { Note } from "../notes/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Textarea } from "../ui/Textarea";
import { BundlePreview } from "./BundlePreview";
import { parseBundle } from "./parse";

// The import dialog: paste or pick a bundle JSON file, see it parsed live — either the listed errors,
// or a preview of the notes and boards it would create (each board as a small static court of its
// first step) with any leniency notices — then confirm to create everything in the active space.
// Nothing is written until the confirm, and a failed write surfaces here instead of pretending.
type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The active space's notes, for minting non-colliding slugs and sibling orders. */
  notes: readonly Note[];
  /** Create the parsed notes (parents first) then boards; resolves null or the error message. */
  onImport: (notes: Note[], boards: Board[]) => Promise<string | null>;
};

export function ImportDialog({ open, onOpenChange, notes, onImport }: ImportDialogProps): JSX.Element {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => (text.trim() ? parseBundle(text, notes) : null), [text, notes]);

  const close = (next: boolean) => {
    if (!next) {
      setText("");
      setWriteError(null);
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!result?.ok) return;

    setImporting(true);
    setWriteError(null);

    const error = await onImport(result.value.notes, result.value.boards);

    setImporting(false);
    if (error !== null) setWriteError(error);
    else close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close} title="Import JSON">
      <Textarea
        compact
        aria-label="Bundle JSON"
        placeholder="Paste a board bundle…"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
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

      {result && !result.ok && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-danger">
          {result.errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}

      {result?.ok && (
        <BundlePreview notes={result.value.notes} boards={result.value.boards} notices={result.value.notices} />
      )}

      {writeError && <p className="m-0 text-sm text-danger">{writeError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => close(false)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!result?.ok || importing} onClick={() => void confirm()}>
          {importing ? "Importing…" : "Import"}
        </Button>
      </div>
    </Dialog>
  );
}
