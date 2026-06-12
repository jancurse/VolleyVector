import type { JSX, ReactNode } from "react";
import { Ellipsis } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Menu, MenuItem } from "../ui/Menu";
import type { Bundle } from "./types";
import { useBundleExport } from "./useBundleExport";

// The page-bar overflow menu of the library and note pages: Copy JSON and Download JSON export the
// surface's bundle, and the library appends its Import JSON… item through `children`. Export needs no
// edit rights — anyone who can view the content may take it with them.
type ExportMenuProps = {
  /** Accessible name for the menu trigger, e.g. "Library actions". */
  label: string;
  /** Builds the bundle Copy and Download emit. */
  bundle: () => Bundle;
  /** The Download filename, e.g. "serve-receive.json". */
  filename: string;
  children?: ReactNode;
};

export function ExportMenu({ label, bundle, filename, children }: ExportMenuProps): JSX.Element {
  const { copied, copy, download } = useBundleExport(bundle, filename);

  return (
    <Menu
      tooltip="More actions"
      trigger={
        <IconButton variant="control" aria-label={label}>
          <Ellipsis size={16} aria-hidden="true" />
        </IconButton>
      }
    >
      <MenuItem closeOnClick={false} onClick={copy}>
        {copied ? "Copied" : "Copy JSON"}
      </MenuItem>
      <MenuItem onClick={download}>Download JSON</MenuItem>
      {children}
    </Menu>
  );
}
