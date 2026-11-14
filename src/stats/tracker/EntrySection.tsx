import type { JSX, ReactNode } from "react";

import { cx, ENTRY_STEP_ACTIVE } from "../../ui/styles";

/** One step of the stat entry (player, skill, result, zone), highlighted while it waits for input. */
export function EntrySection({
  title,
  active,
  hint,
  children,
}: {
  title: string;
  active: boolean;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      aria-label={title}
      className={cx("-m-2 rounded-lg p-2 transition-colors duration-150 ease-settle", active && ENTRY_STEP_ACTIVE)}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-text">{title}</h3>
        {hint && (
          <span
            className={cx(
              "text-right text-xs pointer-coarse:hidden",
              active ? "font-semibold text-accent" : "text-text-dim"
            )}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
