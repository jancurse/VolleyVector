import type { JSX } from "react";
import { Braces, Check } from "lucide-react";

import type { Board } from "../boards/types";
import { IconButton } from "../ui/IconButton";
import { useCopyBoardJson } from "./useCopyBoardJson";

// Copies the board's JSON to the clipboard, confirming briefly by swapping to a check. A quiet utility,
// so it renders as an icon button; the label/tooltip carries the action and the confirmation.
export function CopyJsonButton({ board }: { board: Board }): JSX.Element {
  const { copied, copy } = useCopyBoardJson(board);

  return (
    <IconButton variant="plain" aria-label={copied ? "Copied" : "Copy JSON"} onClick={copy}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Braces size={16} aria-hidden="true" />}
    </IconButton>
  );
}
