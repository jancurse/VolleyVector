import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";

import { stepMarkers } from "../boards/operations";
import type { Board } from "../boards/types";
import { Court } from "../court/Court";
import type { Topic } from "../topics/types";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Textarea } from "../ui/Textarea";
import { FIELD_LABEL } from "../ui/styles";
import { parseBundle } from "./parse";

// The import dialog: paste or pick a bundle JSON file, see it parsed live — either the listed errors,
// or a preview of the topics and boards it would create (each board as a small static court of its
// first step) with any leniency notices — then confirm to create everything in the active space.
// Nothing is written until the confirm, and a failed write surfaces here instead of pretending.
type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The active space's topics, for minting non-colliding slugs and sibling orders. */
  topics: readonly Topic[];
  /** Create the parsed topics (parents first) then boards; resolves null or the error message. */
  onImport: (topics: Topic[], boards: Board[]) => Promise<string | null>;
};

/** Each topic with its depth in the new tree, in the parents-first order the parser returns. */
function withDepths(topics: readonly Topic[]): { topic: Topic; depth: number }[] {
  const depths = new Map<string | null, number>([[null, -1]]);

  return topics.map((topic) => {
    const depth = (depths.get(topic.parentId) ?? -1) + 1;

    depths.set(topic.id, depth);

    return { topic, depth };
  });
}

export function ImportDialog({ open, onOpenChange, topics, onImport }: ImportDialogProps): JSX.Element {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => (text.trim() ? parseBundle(text, topics) : null), [text, topics]);

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

    const error = await onImport(result.value.topics, result.value.boards);

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
        <>
          {result.value.notices.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-text-dim">
              {result.value.notices.map((notice, i) => (
                <li key={i}>{notice}</li>
              ))}
            </ul>
          )}

          {result.value.topics.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className={FIELD_LABEL}>Topics</p>
              {withDepths(result.value.topics).map(({ topic, depth }) => (
                <p key={topic.id} className="m-0 text-sm font-semibold" style={{ paddingLeft: `${depth}rem` }}>
                  {topic.title}
                </p>
              ))}
            </div>
          )}

          {result.value.boards.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className={FIELD_LABEL}>Boards</p>
              <div className="grid grid-cols-2 gap-3">
                {result.value.boards.map((board) => (
                  <div key={board.id} className="overflow-hidden rounded-lg border border-border bg-panel">
                    <div className="aspect-square w-full bg-court-surface" aria-hidden="true">
                      <Court markers={stepMarkers(board, 0)} annotations={board.steps[0].annotations} />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="m-0 text-sm font-semibold">{board.title}</p>
                      <p className="m-0 font-mono text-2xs text-text-dim">
                        {board.steps.length === 1 ? "Position" : `Sequence · ${board.steps.length} steps`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
