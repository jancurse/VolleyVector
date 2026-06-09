import type { JSX } from "react";
import { Moon, Sun } from "lucide-react";

import type { Theme } from "../theme/useTheme";
import { IconButton } from "./IconButton";

type ThemeToggleProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): JSX.Element {
  const isDark = theme === "dark";

  return (
    <IconButton aria-label={`Switch to ${isDark ? "light" : "dark"} theme`} onClick={onToggle}>
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </IconButton>
  );
}
