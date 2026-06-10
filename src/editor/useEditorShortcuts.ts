import { useEffect, useRef } from "react";

import type { AnnotationTool } from "../court/types";
import { TOOL_HOTKEYS } from "./AnnotationToolbar";

// Document-level keyboard shortcuts for the board editor. One listener dispatches over a callbacks
// bag, so every global key lives here in one place. It defers to anything that already handled the
// key (`defaultPrevented`, e.g. the draw hook consuming Escape) and leaves text entry alone: while
// the target is editable nothing here acts, so a field keeps its native undo/redo and typing never
// switches tools.

export type EditorShortcuts = {
  onUndo: () => void;
  onRedo: () => void;
  /** Escape: deselect, or step a drawing tool back to select. */
  onEscape?: () => void;
  /** Delete/Backspace: remove the current selection. */
  onDelete?: () => void;
  /** Ctrl/Cmd+D: duplicate the current selection. */
  onDuplicate?: () => void;
  /** A tool hotkey (V, M, L, A, R, O, P). */
  onTool?: (tool: AnnotationTool) => void;
};

/** True when `target` is a text-entry element, so plain-key shortcuts must not fire. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function useEditorShortcuts(shortcuts: EditorShortcuts): void {
  const bag = useRef(shortcuts);

  useEffect(() => {
    bag.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) bag.current.onRedo();
          else bag.current.onUndo();
        } else if (key === "y") {
          event.preventDefault();
          bag.current.onRedo();
        } else if (key === "d" && bag.current.onDuplicate) {
          // preventDefault beats the browser's bookmark dialog.
          event.preventDefault();
          bag.current.onDuplicate();
        }

        return;
      }

      if (event.altKey) return;

      if (event.key === "Escape") bag.current.onEscape?.();
      else if (event.key === "Delete" || event.key === "Backspace") bag.current.onDelete?.();
      else if (TOOL_HOTKEYS[key]) bag.current.onTool?.(TOOL_HOTKEYS[key]);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
