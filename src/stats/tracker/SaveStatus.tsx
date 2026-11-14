import type { JSX, ReactNode } from "react";
import { AlertTriangle, Check, CloudOff, Loader2, LogIn } from "lucide-react";

import { cx } from "../../ui/styles";
import type { SyncSnapshot } from "../sync/setSync";

const LOOK: Record<SyncSnapshot["saveState"], [tone: string, icon: ReactNode, label: string]> = {
  saved: ["text-text-dim", <Check key="i" size={14} aria-hidden="true" />, "Saved"],
  saving: ["text-text-dim", <Loader2 key="i" size={14} aria-hidden="true" className="animate-spin" />, "Saving…"],
  unsaved: ["text-text-dim", <Loader2 key="i" size={14} aria-hidden="true" className="animate-spin" />, "Saving…"],
  offline: [
    "text-danger",
    <CloudOff key="i" size={14} aria-hidden="true" />,
    "Offline: kept in this browser, retrying",
  ],
  signedOut: ["text-danger", <LogIn key="i" size={14} aria-hidden="true" />, "Signed out: kept in this browser"],
  conflict: ["text-danger", <AlertTriangle key="i" size={14} aria-hidden="true" />, "Not saved: changed elsewhere"],
  refused: ["text-danger", <AlertTriangle key="i" size={14} aria-hidden="true" />, "Not saved: kept in this browser"],
};

/** Where the set's changes are: saved, on their way, or kept in this browser, and why. */
export function SaveStatus({ snapshot }: { snapshot: SyncSnapshot }): JSX.Element {
  const [tone, icon, label] = LOOK[snapshot.saveState];

  return (
    <span
      role="status"
      title={snapshot.error ?? undefined}
      className={cx("inline-flex items-center gap-1 text-xs font-semibold", tone)}
    >
      {icon} {label}
      {snapshot.storageFailed && <span className="text-danger"> · this browser could not keep a copy</span>}
    </span>
  );
}
