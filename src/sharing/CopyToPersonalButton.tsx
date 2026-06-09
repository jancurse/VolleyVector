import { useState } from "react";
import type { JSX } from "react";

import { Button } from "../ui/Button";
import type { ButtonSize } from "../ui/styles";

// Deep-copies the board being viewed into the caller's personal space, confirming briefly on success.
// Used wherever a readable board is shown to a signed-in viewer (a team board, or a shared board's link).
type CopyToPersonalButtonProps = {
  onCopy: () => Promise<{ error: string | null }>;
  size?: ButtonSize;
};

export function CopyToPersonalButton({ onCopy, size = "md" }: CopyToPersonalButtonProps): JSX.Element {
  const [label, setLabel] = useState("Copy to My Boards");

  const run = async () => {
    const { error } = await onCopy();

    setLabel(error ?? "Copied to My Boards");
    if (!error) window.setTimeout(() => setLabel("Copy to My Boards"), 1500);
  };

  return (
    <Button variant="ghost" size={size} onClick={() => void run()}>
      {label}
    </Button>
  );
}
