import { useEffect, useState } from "react";

// Copy text to the clipboard and flip `copied` true for a brief confirmation, then back. The call site
// derives its own label from `copied` (e.g. `copied ? "Copied" : "Copy link"`). `reset` clears the
// confirmation immediately, for a surface that discards its copyable value. Mirrors useBundleExport.
export function useCopyLabel(): { copied: boolean; copy: (text: string) => void; reset: () => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const id = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = (text: string) => {
    // The clipboard call can reject (no permission or an insecure context); keep the view intact.
    void navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  return { copied, copy, reset: () => setCopied(false) };
}
