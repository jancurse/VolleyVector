import type { JSX, ReactNode } from "react";

import { Button } from "../../ui/Button";
import { Kbd } from "./Kbd";

/** A video transport control with its shortcut. */
export function TransportButton({
  children,
  onClick,
  title,
  primary,
  kbd,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  primary?: boolean;
  kbd?: string;
}): JSX.Element {
  return (
    <Button variant={primary ? "primary" : "ghost"} size="sm" paired onClick={onClick} title={title} aria-label={title}>
      {children}
      {kbd && <Kbd onAccent={primary}>{kbd}</Kbd>}
    </Button>
  );
}
