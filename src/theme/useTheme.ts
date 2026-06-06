import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "volleycoach-theme";

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") return stored;

  const prefersLight =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;

  return prefersLight ? "light" : "dark";
}

/** Theme state synced to `document` and persisted, with a toggle between light and dark. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return [theme, () => setTheme((current) => (current === "dark" ? "light" : "dark"))];
}
