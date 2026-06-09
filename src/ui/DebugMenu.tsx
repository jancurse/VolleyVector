import type { JSX } from "react";
import { Bug } from "lucide-react";

import { IconButton } from "./IconButton";
import { Menu, MenuItem } from "./Menu";

// A dev-only control for resetting the browser's local state during development: it clears localStorage
// (the Supabase session and the saved theme) and reloads, dropping back to the login screen. Boards and
// topics now live in Supabase, so there is nothing local to clear for them. App renders this only under
// import.meta.env.DEV, so it never ships in a production build.
export function DebugMenu(): JSX.Element {
  return (
    <Menu
      tooltip="Debug menu"
      trigger={
        <IconButton aria-label="Debug menu" tooltip={null}>
          <Bug size={18} aria-hidden="true" />
        </IconButton>
      }
    >
      <MenuItem
        onClick={() => {
          localStorage.clear();
          window.location.reload();
        }}
      >
        Reset local state
      </MenuItem>
    </Menu>
  );
}
