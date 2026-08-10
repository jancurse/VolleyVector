import type { JSX } from "react";
import { Plus } from "lucide-react";

import type { Selection } from "../library/selection";
import { Collapsible, CollapsibleCaret, CollapsiblePanel } from "../ui/Collapsible";
import { cx } from "../ui/styles";
import { childrenOf } from "./operations";
import { NoteRowMenu } from "./NoteRowMenu";
import type { Note } from "./types";

// The persistent table of contents for the browse surface: All Boards on top, then the note tree
// with disclosure controls, plus a quiet affordance to add a root note. Each row carries a quiet
// organise menu (reorder and nesting) that stays hidden until the row is hovered or focused, so the
// sidebar reads as quiet and typographic rather than as app chrome. Nesting lives here, not in the
// note editor.
type NoteSidebarProps = {
  notes: readonly Note[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onNewNote: () => void;
  onReorder: (id: string, dir: -1 | 1) => void;
  /** Re-parent a note — nesting and un-nesting live here, not in the note editor. */
  onNest: (id: string, parentId: string | null) => void;
  /** Whether to offer the new-note and per-row organise actions (a coach of this team, or an admin). */
  canEdit: boolean;
};

const NAV_ITEM =
  "w-full cursor-pointer rounded-md border-0 bg-transparent px-[0.55rem] py-[0.4rem] text-left font-ui text-base font-semibold text-text-dim transition-colors duration-150 ease-settle hover:bg-control hover:text-text";
const ROW =
  "group flex items-center gap-[0.05rem] rounded-md transition-colors duration-150 ease-settle hover:bg-control";
const LINK =
  "flex-1 min-w-0 cursor-pointer truncate border-0 bg-transparent px-[0.2rem] py-[0.36rem] text-left font-ui text-base font-semibold text-text-dim transition-colors group-hover:text-text";
// Hover-revealed, but a coarse pointer has no hover: there it stays visible rather than being an
// invisible target, which is also the only way the organise actions are discoverable on a phone.
const CONTROLS =
  "flex pr-[0.2rem] opacity-0 transition-opacity duration-150 pointer-coarse:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100";
// The add affordance is a ghost note row, not a button: it shares the rows' anatomy (caret spacer,
// then label), with a plus at the title anchor and a dimmer weight marking it as an action.
const ADD_ROW =
  "flex w-full cursor-pointer items-center gap-[0.05rem] rounded-md border-0 bg-transparent p-0 text-left font-ui text-base font-medium text-text-dim transition-colors duration-150 ease-settle hover:bg-control hover:text-text";

export function NoteSidebar({
  notes,
  selection,
  onSelect,
  onNewNote,
  onReorder,
  onNest,
  canEdit,
}: NoteSidebarProps): JSX.Element {
  const renderRow = (note: Note, depth: number, hasChildren: boolean): JSX.Element => {
    const on = selection.kind === "note" && selection.id === note.id;
    const siblings = childrenOf(notes, note.parentId);
    const index = siblings.findIndex((s) => s.id === note.id);

    return (
      <div className={cx(ROW, on && "bg-accent-weak")} style={{ paddingLeft: `${depth * 0.9}rem` }}>
        {hasChildren ? (
          <CollapsibleCaret label={`Toggle ${note.title} subnotes`} />
        ) : (
          <span className="w-5 flex-none" />
        )}
        <button
          type="button"
          className={cx(LINK, on && "text-text")}
          aria-current={on}
          onClick={() => onSelect({ kind: "note", id: note.id })}
        >
          {note.title}
        </button>
        <span className={cx(CONTROLS, !canEdit && "hidden")}>
          <NoteRowMenu
            title={note.title}
            canMoveUp={index > 0}
            canMoveDown={index < siblings.length - 1}
            nestUnder={index > 0 ? siblings[index - 1].title : null}
            isNested={note.parentId !== null}
            onMove={(dir) => onReorder(note.id, dir)}
            onNest={() => onNest(note.id, siblings[index - 1].id)}
            onMoveToTop={() => onNest(note.id, null)}
          />
        </span>
      </div>
    );
  };

  const renderNote = (note: Note, depth: number): JSX.Element => {
    const children = childrenOf(notes, note.id);

    if (children.length === 0) return <div key={note.id}>{renderRow(note, depth, false)}</div>;

    return (
      <Collapsible key={note.id} defaultOpen>
        {renderRow(note, depth, true)}
        <CollapsiblePanel>{children.map((child) => renderNote(child, depth + 1))}</CollapsiblePanel>
      </Collapsible>
    );
  };

  return (
    <nav className="flex flex-col gap-[0.1rem]" aria-label="Notes">
      <button
        type="button"
        className={cx(NAV_ITEM, selection.kind === "all" && "bg-accent-weak text-text")}
        aria-current={selection.kind === "all"}
        onClick={() => onSelect({ kind: "all" })}
      >
        All Boards
      </button>

      <p className="mt-4 mb-[0.35rem] px-[0.55rem] font-mono text-2xs font-medium uppercase tracking-[0.22em] text-text-dim">
        Notes
      </p>
      <div className="flex flex-col gap-[0.05rem]">
        {childrenOf(notes, null).map((note) => renderNote(note, 0))}
        {canEdit && (
          <button type="button" className={ADD_ROW} onClick={onNewNote}>
            <span className="w-5 flex-none" />
            <span className="flex items-center gap-1.5 px-[0.2rem] py-[0.36rem]">
              <Plus size={13} aria-hidden="true" />
              New note
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
