import type { JSX, ReactNode } from "react";

import { cx } from "../ui/styles";
import type { SidebarMode } from "./useSidebarMode";

// The persistent layout: the sidebar in a fixed left column, the slim top bar and the routed content
// stacked in the right column. The background glow spans the whole shell, behind both columns. The
// left column follows the sidebar mode — the full 16rem sidebar, the slim icon rail, or (drawer mode)
// no column at all. The sidebar and top bar are supplied by App, already wired to the stores.
type AppShellProps = {
  mode: SidebarMode;
  /** The left column's content (the full sidebar or the rail); omitted in drawer mode. */
  sidebar?: ReactNode;
  topBar: ReactNode;
  /** Give the content the whole window: no sidebar and no top bar (the tracker's focus mode). */
  bare?: boolean;
  /** Hold the content to the window's height, so it lays itself out as a workspace instead of a page. */
  fill?: boolean;
  children: ReactNode;
};

const SHELL = "grid min-h-[100dvh] [background:var(--app-backdrop)] transition-[background-color] duration-[400ms]";

const COLUMNS: Record<SidebarMode, string> = {
  full: "grid-cols-[16rem_minmax(0,1fr)]",
  rail: "grid-cols-[3.5rem_minmax(0,1fr)]",
  drawer: "grid-cols-[minmax(0,1fr)]",
};

const CONTENT =
  "flex min-h-0 flex-1 flex-col items-center px-[clamp(1rem,3vw,2.5rem)] pt-[clamp(1rem,2.5vh,1.75rem)] pb-[clamp(1.5rem,4vh,2.5rem)]";

const CONTENT_FILL = "flex min-h-0 flex-1 flex-col p-3";

export function AppShell({ mode, sidebar, topBar, bare = false, fill = false, children }: AppShellProps): JSX.Element {
  return (
    <div className={cx(SHELL, COLUMNS[bare ? "drawer" : mode])}>
      {!bare && sidebar}
      <div className={cx("flex min-w-0 flex-col", fill && "h-dvh")}>
        {!bare && topBar}
        <main className={fill ? CONTENT_FILL : CONTENT}>{children}</main>
      </div>
    </div>
  );
}
