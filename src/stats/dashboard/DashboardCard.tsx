import type { JSX, ReactNode } from "react";

import { cx, DASH_CARD, DASH_CARD_TITLE, DASH_WIDE } from "../../ui/styles";

/** A dashboard card: a title, an optional control beside it, and the content; `wide` spans two columns. */
export function DashboardCard({
  title,
  action,
  wide,
  children,
}: {
  title: string;
  action?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <section aria-label={title} className={cx(DASH_CARD, "@container", wide && DASH_WIDE)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={DASH_CARD_TITLE}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
