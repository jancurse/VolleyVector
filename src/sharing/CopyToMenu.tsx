import { useState } from "react";
import type { JSX } from "react";

import { MenuItem, SubMenu } from "../ui/Menu";

// The board view's unified copy action: one target per space the viewer may write to. Copying to the
// space the board is already in duplicates it there (the caller updates the open list and navigates to
// the copy); a cross-space copy stays put and confirms through the item's label. A single target renders
// as a direct item rather than a one-entry submenu.
export type CopyTarget = { key: string; label: string } & (
  | { kind: "duplicate"; onDuplicate: () => Promise<{ error: string | null }> }
  | { kind: "copy"; onCopy: () => Promise<{ error: string | null }> }
);

function CopyItem({ target, flat }: { target: CopyTarget; flat: boolean }): JSX.Element {
  // Transient feedback ("Copied", or the error) overriding the item's label.
  const [status, setStatus] = useState<string | null>(null);
  const duplicate = target.kind === "duplicate";

  const run = () => {
    void (duplicate ? target.onDuplicate() : target.onCopy()).then(({ error }) => {
      // A successful duplicate navigates to the copy, unmounting the menu — no feedback needed.
      if (error) setStatus(error);
      else if (!duplicate) {
        setStatus("Copied");
        window.setTimeout(() => setStatus(null), 1500);
      }
    });
  };

  const label = duplicate
    ? flat
      ? "Duplicate"
      : `${target.label} (duplicate here)`
    : flat
      ? `Copy to ${target.label}`
      : target.label;

  return (
    <MenuItem closeOnClick={false} onClick={run}>
      {status ?? label}
    </MenuItem>
  );
}

export function CopyToMenu({ targets }: { targets: readonly CopyTarget[] }): JSX.Element {
  if (targets.length === 1) return <CopyItem target={targets[0]} flat />;

  return (
    <SubMenu label="Copy to">
      {targets.map((t) => (
        <CopyItem key={t.key} target={t} flat={false} />
      ))}
    </SubMenu>
  );
}
