import type { JSX } from "react";

import { MenuItem } from "../ui/Menu";
import { useCopyToPersonal } from "./useCopyToPersonal";

// The copy-to-personal action as an overflow-menu item. It stays put and confirms through its label, so
// the menu does not snap shut on the feedback.
export function CopyToPersonalMenuItem({ onCopy }: { onCopy: () => Promise<{ error: string | null }> }): JSX.Element {
  const { label, run } = useCopyToPersonal(onCopy);

  return (
    <MenuItem closeOnClick={false} onClick={run}>
      {label}
    </MenuItem>
  );
}
