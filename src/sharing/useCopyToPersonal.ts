import { useState } from "react";

// Deep-copies the board being viewed into the caller's personal space, reporting the result through the
// control's label: a brief confirmation on success, the error message on failure. Shared by the board
// view's overflow menu item and the share page's button.
export function useCopyToPersonal(onCopy: () => Promise<{ error: string | null }>): {
  label: string;
  run: () => void;
} {
  const [label, setLabel] = useState("Copy to My Boards");

  const run = () => {
    void onCopy().then(({ error }) => {
      setLabel(error ?? "Copied to My Boards");
      if (!error) window.setTimeout(() => setLabel("Copy to My Boards"), 1500);
    });
  };

  return { label, run };
}
