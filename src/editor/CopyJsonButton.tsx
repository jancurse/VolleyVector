import { useEffect, useState } from "react";
import type { JSX } from "react";
import { Braces, Check } from "lucide-react";

import type { Board } from "../boards/types";
import { IconButton } from "../ui/IconButton";
import type { IconButtonSize } from "../ui/styles";

// Copies the board's JSON to the clipboard, confirming briefly by swapping to a check. A quiet utility,
// so it renders as an icon button; the label/tooltip carries the action and the confirmation.
export function CopyJsonButton({ board, size = "md" }: { board: Board; size?: IconButtonSize }): JSX.Element {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const id = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(board, null, 2));
      setCopied(true);
    } catch {
      // The clipboard call can reject (no permission or an insecure context); keep the view intact.
    }
  };

  return (
    <IconButton variant="plain" size={size} aria-label={copied ? "Copied" : "Copy JSON"} onClick={() => void copy()}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Braces size={16} aria-hidden="true" />}
    </IconButton>
  );
}
