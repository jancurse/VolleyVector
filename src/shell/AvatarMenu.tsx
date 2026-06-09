import type { JSX } from "react";

import type { Theme } from "../theme/useTheme";
import { Menu, MenuItem } from "../ui/Menu";
import { cx } from "../ui/styles";

// The single top-right account control: an initials avatar opening a menu with account settings, the
// theme toggle, sign out, and delete account. In a development build the debug "reset local state" action
// folds in here too, so nothing else needs to live in the top bar.
type AvatarMenuProps = {
  displayName: string;
  email: string;
  theme: Theme;
  onToggleTheme: () => void;
  onAccountSettings: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

const AVATAR = cx(
  "grid size-9 flex-none cursor-pointer place-items-center rounded-full border border-border bg-accent-weak",
  "font-mono text-sm font-semibold text-accent transition-[background-color,transform] duration-150 ease-settle",
  "hover:bg-control-hover active:scale-[0.94]"
);

const HEADER = "flex flex-col gap-0.5 px-2 pt-1.5 pb-2";
const DIVIDER = "my-1 h-px bg-border";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function AvatarMenu({
  displayName,
  email,
  theme,
  onToggleTheme,
  onAccountSettings,
  onSignOut,
  onDeleteAccount,
}: AvatarMenuProps): JSX.Element {
  return (
    <Menu
      tooltip="Account"
      align="end"
      trigger={
        <button type="button" aria-label="Account menu" className={AVATAR}>
          {initials(displayName)}
        </button>
      }
    >
      <div className={HEADER}>
        <p className="truncate font-ui text-base font-semibold text-text">{displayName || "Your account"}</p>
        <p className="truncate font-ui text-xs text-text-dim">{email}</p>
      </div>
      <div className={DIVIDER} />
      <MenuItem onClick={onAccountSettings}>Account settings</MenuItem>
      <MenuItem onClick={onToggleTheme}>{theme === "dark" ? "Light theme" : "Dark theme"}</MenuItem>
      {import.meta.env.DEV && (
        <MenuItem
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
        >
          Reset local state
        </MenuItem>
      )}
      <div className={DIVIDER} />
      <MenuItem onClick={onSignOut}>Sign out</MenuItem>
      <MenuItem onClick={onDeleteAccount}>
        <span className="text-danger">Delete account</span>
      </MenuItem>
    </Menu>
  );
}
