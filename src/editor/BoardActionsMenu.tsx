import type { JSX, ReactNode } from "react";
import { Ellipsis } from "lucide-react";

import type { Board } from "../boards/types";
import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { useCopyBoardJson } from "./useCopyBoardJson";

// The board view's overflow menu, beside the title-row actions: the occasional actions (the copy and
// move targets, the author lock, Copy JSON) as labelled menu items, keeping the visible row to share
// and Edit.
type BoardActionsMenuProps = {
  board: Board;
  /** Whether the viewer may toggle the author lock (the board's author or an admin, on a team board). */
  canLock: boolean;
  onToggleLock: () => void;
  /** The leading menu items (the Copy to and Move to actions), separated from the rest. */
  children?: ReactNode;
};

export function BoardActionsMenu({ board, canLock, onToggleLock, children }: BoardActionsMenuProps): JSX.Element {
  const { copied, copy } = useCopyBoardJson(board);

  return (
    <Menu
      tooltip="More actions"
      trigger={
        <IconButton variant="plain" aria-label="Board actions">
          <Ellipsis size={16} aria-hidden="true" />
        </IconButton>
      }
    >
      {children}
      {children && <MenuSeparator />}
      {canLock && <MenuItem onClick={onToggleLock}>{board.authorLocked ? "Unlock editing" : "Lock editing"}</MenuItem>}
      <MenuItem closeOnClick={false} onClick={copy}>
        {copied ? "Copied" : "Copy JSON"}
      </MenuItem>
    </Menu>
  );
}
