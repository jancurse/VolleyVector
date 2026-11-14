import type { JSX, ReactNode } from "react";

import { cx, KBD, KBD_ON_ACCENT, KBD_QUIET } from "../../ui/styles";

/** A keyboard-shortcut badge on the control it triggers. `dim` when the key does not act right now. */
export function Kbd({
  children,
  onAccent,
  dim,
}: {
  children: ReactNode;
  onAccent?: boolean;
  dim?: boolean;
}): JSX.Element {
  return <kbd className={cx(KBD, onAccent ? KBD_ON_ACCENT : KBD_QUIET, dim && "opacity-60")}>{children}</kbd>;
}
