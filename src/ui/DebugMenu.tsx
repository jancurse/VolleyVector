import type { JSX } from "react";

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
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="8" width="6" height="11" rx="3" />
            <path d="M12 8v11M6 11h3M15 11h3M6 15h3M15 15h3M9.2 6 10.5 8M14.8 6 13.5 8" />
          </svg>
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
