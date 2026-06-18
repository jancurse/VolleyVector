import { useMemo, useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Textarea } from "../ui/Textarea";
import { BundlePreview } from "./BundlePreview";
import { parseBundle } from "./parse";

// Replaces one board's content from a pasted single-board bundle, keeping its identity (id, creator,
// access list, timestamps), so iterating on a board with externally authored JSON needs no
// delete-and-reimport. Parses live like the import dialog; nothing is written until the confirm.
type ReplaceBoardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The board whose content the bundle replaces. */
  board: Board;
  /** Save the replaced board; resolves null or the error message. */
  onReplace: (board: Board) => Promise<string | null>;
};

export function ReplaceBoardDialog({ open, onOpenChange, board, onReplace }: ReplaceBoardDialogProps): JSX.Element {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const result = useMemo(() => (text.trim() ? parseBundle(text, []) : null), [text]);
  const replacement =
    result?.ok && result.value.notes.length === 0 && result.value.boards.length === 1
      ? {
          ...result.value.boards[0],
          id: board.id,
          createdBy: board.createdBy,
          capability: board.capability,
          currentRevisionId: board.currentRevisionId,
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        }
      : null;
  const errors = !result || result.ok ? [] : result.errors;

  const close = (next: boolean) => {
    if (!next) {
      setText("");
      setWriteError(null);
    }
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!replacement) return;

    setSaving(true);
    setWriteError(null);

    const error = await onReplace(replacement);

    setSaving(false);
    if (error !== null) setWriteError(error);
    else close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close} title="Replace from JSON">
      <Textarea
        compact
        aria-label="Bundle JSON"
        placeholder="Paste a single-board bundle…"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {result?.ok && !replacement && (
        <p className="m-0 text-sm text-danger">The bundle must carry exactly one board and no notes.</p>
      )}

      {errors.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-danger">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}

      {result?.ok && replacement && <BundlePreview notes={[]} boards={[replacement]} notices={result.value.notices} />}

      {writeError && <p className="m-0 text-sm text-danger">{writeError}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" paired onClick={() => close(false)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!replacement || saving} onClick={() => void confirm()}>
          {saving ? "Replacing…" : "Replace"}
        </Button>
      </div>
    </Dialog>
  );
}
