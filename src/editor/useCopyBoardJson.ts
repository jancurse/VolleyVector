import { useEffect, useState } from "react";

import type { Board } from "../boards/types";

// Copies the board's JSON to the clipboard and reports a brief "copied" confirmation, shared by the
// board view's overflow menu and the share page's icon button.
export function useCopyBoardJson(board: Board): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const id = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = () => {
    // The clipboard call can reject (no permission or an insecure context); keep the view intact.
    void navigator.clipboard
      .writeText(JSON.stringify(board, null, 2))
      .then(() => setCopied(true))
      .catch(() => {});
  };

  return { copied, copy };
}
