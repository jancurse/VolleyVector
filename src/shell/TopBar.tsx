import type { JSX, ReactNode } from "react";
import { PanelLeft } from "lucide-react";

import type { Route } from "../routing/route";
import { IconButton } from "../ui/IconButton";
import { Breadcrumb } from "./Breadcrumb";
import type { Crumb } from "./breadcrumb";

// The slim navigation bar above the content: a breadcrumb on the left and the single account control on
// the right, nothing else — every surface's actions live in its own content header. It stays put as the
// content scrolls so the trail and account are always reachable. In drawer mode a leading toggle opens
// the navigation overlay, since no sidebar column is on screen.
type TopBarProps = {
  crumbs: Crumb[];
  onNavigate: (route: Route) => void;
  /** Opens the navigation drawer; present only when no sidebar column is shown. */
  onOpenNav?: () => void;
  /** The account control, always on the far right. */
  account: ReactNode;
};

export function TopBar({ crumbs, onNavigate, onOpenNav, account }: TopBarProps): JSX.Element {
  return (
    <header className="sticky top-0 z-20 flex h-15 flex-none items-center gap-3 border-b border-border bg-bg/75 px-[clamp(1rem,3vw,2rem)] backdrop-blur-md">
      {onOpenNav && (
        <IconButton variant="plain" size="sm" aria-label="Open navigation" className="-ml-1" onClick={onOpenNav}>
          <PanelLeft size={17} aria-hidden="true" />
        </IconButton>
      )}
      <Breadcrumb crumbs={crumbs} onNavigate={onNavigate} className="flex-1" />
      <div className="flex-none">{account}</div>
    </header>
  );
}
