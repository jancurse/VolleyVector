import type { JSX } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import type { ThemePreference } from "../theme/useTheme";
import { Menu, MenuItem } from "../ui/Menu";
import { ToggleGroup } from "../ui/ToggleGroup";
import { initials } from "../ui/initials";
import { cx } from "../ui/styles";

// The single top-right account control: an initials avatar opening a menu with account settings, the
// theme picker, sign out, and delete account, so nothing else needs to live in the top bar.
type AvatarMenuProps = {
  displayName: string;
  email: string;
  themePreference: ThemePreference;
  onSetTheme: (preference: ThemePreference) => void;
  onAccountSettings: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
};

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
  { value: "system", label: "System", icon: <Monitor size={15} aria-hidden="true" /> },
  { value: "light", label: "Light", icon: <Sun size={15} aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <Moon size={15} aria-hidden="true" /> },
];

const AVATAR = cx(
  "grid size-9 flex-none cursor-pointer place-items-center rounded-full border border-border bg-accent-weak",
  "font-mono text-sm font-semibold text-accent transition-[background-color,transform] duration-150 ease-settle",
  "hover:bg-control-hover active:scale-[0.94]"
);

const HEADER = "flex flex-col gap-0.5 px-2 pt-1.5 pb-2";
const DIVIDER = "my-1 h-px bg-border";

export function AvatarMenu({
  displayName,
  email,
  themePreference,
  onSetTheme,
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
      <div className={DIVIDER} />
      <div className="flex items-center justify-between gap-4 px-2 py-1.5">
        <span className="font-ui text-sm font-medium text-text-dim">Theme</span>
        <ToggleGroup
          ariaLabel="Theme"
          items={THEME_OPTIONS.map(({ value, label, icon }) => ({ value, label: icon, ariaLabel: label }))}
          value={themePreference}
          onValueChange={(value) => onSetTheme(value === "light" || value === "dark" ? value : "system")}
        />
      </div>
      <div className={DIVIDER} />
      <MenuItem onClick={onSignOut}>Sign out</MenuItem>
      <MenuItem onClick={onDeleteAccount}>
        <span className="text-danger">Delete account</span>
      </MenuItem>
    </Menu>
  );
}
