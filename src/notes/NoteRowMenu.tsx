import type { JSX } from "react";
import { Ellipsis } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem } from "../ui/Menu";

// The per-row organise menu for a sidebar note: one quiet "⋯" button that opens reorder and nesting
// actions, replacing the row of cryptic arrows. The Menu primitive handles keyboard navigation and
// escape/outside-click dismissal. Only the actions that apply to this row are shown (e.g. no "Move to
// top level" on a root).
type NoteRowMenuProps = {
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The sibling above, which this note would nest under — or null when there is none. */
  nestUnder: string | null;
  /** Whether this note is nested, so it can be moved back to the top level. */
  isNested: boolean;
  onMove: (dir: -1 | 1) => void;
  onNest: () => void;
  onMoveToTop: () => void;
};

const DOTS = <Ellipsis size={16} aria-hidden="true" />;

export function NoteRowMenu({
  title,
  canMoveUp,
  canMoveDown,
  nestUnder,
  isNested,
  onMove,
  onNest,
  onMoveToTop,
}: NoteRowMenuProps): JSX.Element {
  return (
    <Menu
      tooltip={`Organize ${title}`}
      trigger={
        <IconButton variant="plain" size="sm" aria-label={`Organize ${title}`} tooltip={null}>
          {DOTS}
        </IconButton>
      }
    >
      <MenuItem disabled={!canMoveUp} onClick={() => onMove(-1)}>
        Move up
      </MenuItem>
      <MenuItem disabled={!canMoveDown} onClick={() => onMove(1)}>
        Move down
      </MenuItem>
      {nestUnder && <MenuItem onClick={onNest}>Nest under {nestUnder}</MenuItem>}
      {isNested && <MenuItem onClick={onMoveToTop}>Move to top level</MenuItem>}
    </Menu>
  );
}
