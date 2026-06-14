import type { JSX, ReactNode } from "react";
import { Ellipsis } from "lucide-react";

import type { Board } from "../boards/types";
import { bundleFilename, toBundle } from "../bundle/serialize";
import { useBundleExport } from "../bundle/useBundleExport";
import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";

// The board view's overflow menu, beside the title-row actions: the occasional actions (managing access,
// the copy targets, printing, the JSON export, deletion) as labelled menu items, keeping the visible row to
// Edit alone.
type BoardActionsMenuProps = {
  board: Board;
  /** Opens the access manager; present only for an owner of the board. */
  onManageAccess?: () => void;
  /** Opens the board's print/handout view. */
  onPrint: () => void;
  /** Opens the replace-from-JSON dialog; absent when the viewer may not edit the board. */
  onReplace?: () => void;
  /** Deletes the board (behind its own confirmation); present only for a viewer who may edit it. */
  onDelete?: () => void;
  /** The leading menu items (the Copy to and Move to actions), separated from the rest. */
  children?: ReactNode;
};

export function BoardActionsMenu({
  board,
  onManageAccess,
  onPrint,
  onReplace,
  onDelete,
  children,
}: BoardActionsMenuProps): JSX.Element {
  const { copied, copy, download } = useBundleExport(() => toBundle([board], []), bundleFilename(board.title));

  return (
    <Menu
      tooltip="More actions"
      trigger={
        <IconButton variant="control" aria-label="Board actions">
          <Ellipsis size={16} aria-hidden="true" />
        </IconButton>
      }
    >
      {onManageAccess && <MenuItem onClick={onManageAccess}>Manage access…</MenuItem>}
      {children}
      {(onManageAccess || children) && <MenuSeparator />}
      <MenuItem onClick={onPrint}>Print…</MenuItem>
      <MenuItem closeOnClick={false} onClick={copy}>
        {copied ? "Copied" : "Copy JSON"}
      </MenuItem>
      <MenuItem onClick={download}>Download JSON</MenuItem>
      {onReplace && <MenuItem onClick={onReplace}>Replace from JSON…</MenuItem>}
      {onDelete && (
        <>
          <MenuSeparator />
          <MenuItem onClick={onDelete}>
            <span className="text-danger">Delete board…</span>
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
