import type { JSX, ReactNode } from "react";

import { cx, PAGE } from "../../ui/styles";

/** The set page while it loads or cannot open: its message and actions, centred on the page. */
export function Centered({ children }: { children: ReactNode }): JSX.Element {
  return <div className={cx(PAGE, "items-center pt-10 text-center text-text-dim")}>{children}</div>;
}
