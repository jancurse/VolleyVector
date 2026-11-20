import type { JSX, ReactNode } from "react";

import { Button } from "../../ui/Button";
import { Kbd } from "./Kbd";

/** A video transport control with its shortcut. */
export function TransportButton({
  children,
  onClick,
  title,
  kbd,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  kbd?: string;
}): JSX.Element {
  return (
    <Button variant="ghost" size="sm" paired onClick={onClick} title={title} aria-label={title}>
      {children}
      {kbd && <Kbd>{kbd}</Kbd>}
    </Button>
  );
}
