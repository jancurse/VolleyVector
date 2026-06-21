import type { Board } from "../boards/types";

// A best-effort localStorage backup of the board editor's working draft, keyed by board id, so a
// reload or crash mid-edit cannot destroy the work. `updatedAt` is stamped at write time, so a backup
// newer than the saved board is exactly an unsaved edit. Storage failures (quota, private mode) are
// swallowed: the backup is a safety net, never a required write.

const key = (boardId: string) => `volleyvector-draft-${boardId}`;

export function saveDraftBackup(draft: Board): void {
  try {
    localStorage.setItem(key(draft.id), JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {
    // Best-effort only.
  }
}

export function loadDraftBackup(boardId: string): Board | null {
  try {
    const raw = localStorage.getItem(key(boardId));

    return raw === null ? null : (JSON.parse(raw) as Board);
  } catch {
    return null;
  }
}

export function clearDraftBackup(boardId: string): void {
  localStorage.removeItem(key(boardId));
}
