import { useMemo, useState } from "react";
import type { JSX } from "react";

import type { Board } from "../boards/types";
import { BoardEditor } from "../editor/BoardEditor";
import { BoardView } from "../editor/BoardView";
import { clearDraftBackup } from "../editor/draftBackup";
import { allTags } from "../library/items";
import type { Note } from "../notes/types";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { EYEBROW, MUTED, PAGE, PAGE_BAR, TITLE } from "../ui/styles";
import { BundlePreview } from "./BundlePreview";
import { parseBundle } from "./parse";
import { toBundle } from "./serialize";

// The dev-only `#/preview` surface: the bundles the board-creator skill writes to the gitignored
// drafts/ folder, listed in a dropdown and rendered through the same preview and write path as the
// import dialog. `import.meta.glob` is both the file lister and the watcher — Vite HMR-updates this
// module whenever a globbed file changes, so a rewritten draft re-renders with no manual reload.
// App only mounts this behind `import.meta.env.DEV`, so the glob (and every draft's contents) never
// reaches a production bundle.
const drafts = import.meta.glob<string>("/drafts/*.json", { query: "?raw", import: "default", eager: true });

const byName = new Map(Object.entries(drafts).map(([path, text]) => [path.slice(path.lastIndexOf("/") + 1), text]));
const names = [...byName.keys()].sort();

const STORAGE_KEY = "volleycoach-draft-preview-file";

type DraftPreviewProps = {
  /** The active space's notes, for minting non-colliding slugs and sibling orders. */
  notes: readonly Note[];
  /** Whether the user may create content in the active space; without it the import button is hidden. */
  canEdit: boolean;
  /** Create the parsed notes (parents first) then boards; resolves null or the error message. */
  onImport: (notes: Note[], boards: Board[]) => Promise<string | null>;
};

export function DraftPreview({ notes, canEdit, onImport }: DraftPreviewProps): JSX.Element {
  const [picked, setPicked] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  // Locally edited boards, keyed by their index in the file's order. Everything on this page — the
  // card grid, the open view, the clipboard copy, and Import — renders and acts on the file with
  // these edits laid over it, so small in-app edits are never lost short of an import or a paste
  // back to the skill. An HMR rewrite of the file (the skill folding the edits in) clears them.
  const [edits, setEdits] = useState<Record<number, Board>>({});
  const [importing, setImporting] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  // One file selects itself; otherwise the last-used pick, falling back to the first. The hot loop —
  // the skill rewriting the already-selected file — needs no selection at all.
  const selected = names.length === 1 ? names[0] : picked !== null && byName.has(picked) ? picked : (names[0] ?? null);
  const text = selected !== null ? byName.get(selected) : undefined;
  const result = useMemo(() => (text !== undefined ? parseBundle(text, notes) : null), [text, notes]);

  // A change to the file's text means the skill rewrote it (or another file was picked below); drop
  // the local edits and any open editor so the file shows. Adjusting state during render, as App does.
  const [seenText, setSeenText] = useState(text);

  if (seenText !== text) {
    setSeenText(text);
    setEdits({});
    setEditing(false);
  }

  const boards = result?.ok ? result.value.boards.map((board, i) => edits[i] ?? board) : [];

  const close = () => {
    window.location.hash = "";
  };

  const closeBoard = () => {
    setOpenIndex(null);
    setEditing(false);
  };

  // An opened card shows the full view (a Sequence plays there), with the normal editor behind Edit.
  // Keyed by index, not board id, so an HMR rewrite updates the open board in place instead of
  // remounting it; if the rewrite breaks the JSON or drops the board, fall through to the list.
  const openBoard = openIndex !== null ? (boards[openIndex] ?? null) : null;

  if (openIndex !== null && openBoard !== null && result?.ok && editing) {
    // The editor commits to the clipboard, not the database: Copy JSON puts the whole bundle (with
    // every local edit laid over the file) on the clipboard to paste back to the board-creator skill,
    // which updates the draft file. Import below stays the only path that writes to the space.
    return (
      <BoardEditor
        key={openIndex}
        board={openBoard}
        tagSuggestions={allTags(boards)}
        doneLabel="Save & copy JSON"
        onCancel={() => {
          clearDraftBackup(openBoard.id);
          setEditing(false);
        }}
        onDone={async (updated) => {
          const merged = boards.map((b, i) => (i === openIndex ? updated : b));

          try {
            await navigator.clipboard.writeText(JSON.stringify(toBundle(merged, result.value.notes), null, 2));
          } catch {
            return "the clipboard copy was blocked";
          }

          clearDraftBackup(updated.id);
          setEdits((prev) => ({ ...prev, [openIndex]: updated }));
          setEditing(false);

          return null;
        }}
      />
    );
  }

  if (openBoard !== null) {
    return (
      <BoardView
        key={openIndex}
        board={openBoard}
        backLabel="← Drafts"
        onBack={closeBoard}
        actions={
          <Button variant="primary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        }
      />
    );
  }

  const confirm = async () => {
    if (!result?.ok) return;

    setImporting(true);
    setWriteError(null);

    const error = await onImport(result.value.notes, boards);

    setImporting(false);
    if (error !== null) setWriteError(error);
    else close();
  };

  return (
    <section className={PAGE}>
      <div className={PAGE_BAR}>
        <div>
          <p className={EYEBROW}>Dev only</p>
          <h1 className={TITLE}>Draft preview</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" paired onClick={close}>
            Back
          </Button>
          {canEdit && (
            <Button variant="primary" disabled={!result?.ok || importing} onClick={() => void confirm()}>
              {importing ? "Importing…" : "Import"}
            </Button>
          )}
        </div>
      </div>

      {names.length === 0 ? (
        <p className={MUTED}>
          No drafts found. Ask the board-creator skill to write a bundle to <code>drafts/</code>.
        </p>
      ) : (
        <div className="flex w-full max-w-[36rem] flex-col gap-4">
          <Select
            ariaLabel="Draft file"
            value={selected ?? ""}
            onValueChange={(value) => {
              setPicked(value);
              closeBoard();
              localStorage.setItem(STORAGE_KEY, value);
            }}
            options={names.map((name) => ({ value: name, label: name }))}
          />

          {result && !result.ok && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-danger">
              {result.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          )}

          {result?.ok && (
            <BundlePreview
              notes={result.value.notes}
              boards={boards}
              notices={result.value.notices}
              onOpenBoard={setOpenIndex}
            />
          )}

          {writeError && <p className="m-0 text-sm text-danger">{writeError}</p>}
        </div>
      )}
    </section>
  );
}
