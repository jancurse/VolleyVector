import type { JSX } from "react";

import { Button } from "../ui/Button";
import { useCopyToPersonal } from "./useCopyToPersonal";

// The copy-to-personal action as a button, used on the share page; in the app it lives in the board
// view's overflow menu instead.
export function CopyToPersonalButton({ onCopy }: { onCopy: () => Promise<{ error: string | null }> }): JSX.Element {
  const { label, run } = useCopyToPersonal(onCopy);

  return (
    <Button variant="ghost" onClick={run}>
      {label}
    </Button>
  );
}
