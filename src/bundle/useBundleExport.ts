import { useEffect, useState } from "react";

import type { Bundle } from "./types";

// Offers one bundle two ways: Copy JSON puts it on the clipboard with a brief "copied" confirmation,
// Download JSON saves it as a file. Shared by the board, topic, and space export surfaces.
export function useBundleExport(
  bundle: () => Bundle,
  filename: string
): { copied: boolean; copy: () => void; download: () => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const id = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = () => {
    // The clipboard call can reject (no permission or an insecure context); keep the view intact.
    void navigator.clipboard
      .writeText(JSON.stringify(bundle(), null, 2))
      .then(() => setCopied(true))
      .catch(() => {});
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle(), null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return { copied, copy, download };
}
