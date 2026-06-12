import type { JSX } from "react";
import { Braces, Check } from "lucide-react";

import type { Board } from "../boards/types";
import { bundleFilename, toBundle } from "../bundle/serialize";
import { useBundleExport } from "../bundle/useBundleExport";
import { IconButton } from "../ui/IconButton";

// Copies the board as a single-board bundle to the clipboard, confirming briefly by swapping to a
// check. A quiet utility, so it renders as an icon button; the label/tooltip carries the action and
// the confirmation.
export function CopyJsonButton({ board }: { board: Board }): JSX.Element {
  const { copied, copy } = useBundleExport(() => toBundle([board], []), bundleFilename(board.title));

  return (
    <IconButton variant="plain" aria-label={copied ? "Copied" : "Copy JSON"} onClick={copy}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Braces size={16} aria-hidden="true" />}
    </IconButton>
  );
}
