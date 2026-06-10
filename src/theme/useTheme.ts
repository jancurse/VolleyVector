import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const STORAGE_KEY = "volleycoach-theme";

function systemTheme(): Theme {
  const prefersLight =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;

  return prefersLight ? "light" : "dark";
}

function initialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * Theme state synced to `document`. Only an explicit light/dark pick is persisted; "system" stores
 * nothing and follows the OS preference live, so an OS theme change retints the app immediately.
 */
export function useTheme(): [Theme, ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(initialPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setSystem(query.matches ? "light" : "dark");

    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = preference === "system" ? system : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return [
    theme,
    preference,
    (next) => {
      setPreference(next);

      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    },
  ];
}
