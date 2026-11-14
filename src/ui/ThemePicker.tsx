import type { JSX } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import type { ThemePreference } from "../theme/useTheme";
import { ToggleGroup } from "./ToggleGroup";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
  { value: "system", label: "System", icon: <Monitor size={15} aria-hidden="true" /> },
  { value: "light", label: "Light", icon: <Sun size={15} aria-hidden="true" /> },
  { value: "dark", label: "Dark", icon: <Moon size={15} aria-hidden="true" /> },
];

/** System, light, or dark: the theme switch in the account menu. */
export function ThemePicker({
  preference,
  onChange,
}: {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}): JSX.Element {
  return (
    <ToggleGroup
      ariaLabel="Theme"
      items={THEME_OPTIONS.map(({ value, label, icon }) => ({ value, label: icon, ariaLabel: label }))}
      value={preference}
      onValueChange={(value) => onChange(value === "light" || value === "dark" ? value : "system")}
    />
  );
}
