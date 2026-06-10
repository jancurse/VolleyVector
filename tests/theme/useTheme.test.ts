import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { useTheme } from "../../src/theme/useTheme";

// A controllable stand-in for the OS colour-scheme query: `setLight` flips the preference and fires
// the change listeners, simulating the user switching their OS theme while the app is open.
function mockSystemTheme(light: boolean): { setLight: (next: boolean) => void } {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  const query = {
    get matches() {
      return light;
    },
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.push(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.splice(listeners.indexOf(listener), 1),
  };

  vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);

  return {
    setLight: (next: boolean) => {
      light = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
  };
}

describe("useTheme", () => {
  afterEach(() => {
    localStorage.removeItem("volleycoach-theme");
    vi.restoreAllMocks();
  });

  test("a stored pick wins over the OS preference", () => {
    mockSystemTheme(true);
    localStorage.setItem("volleycoach-theme", "dark");

    const { result } = renderHook(() => useTheme());

    expect(result.current[0]).toBe("dark");
    expect(result.current[1]).toBe("dark");
  });

  test("system follows a live OS change and stores nothing", () => {
    const os = mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());

    expect(result.current[1]).toBe("system");
    expect(result.current[0]).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => os.setLight(true));

    expect(result.current[0]).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("volleycoach-theme")).toBeNull();
  });

  test("an explicit pick persists; returning to system clears it", () => {
    mockSystemTheme(true);

    const { result } = renderHook(() => useTheme());

    act(() => result.current[2]("dark"));
    expect(result.current[0]).toBe("dark");
    expect(localStorage.getItem("volleycoach-theme")).toBe("dark");

    act(() => result.current[2]("system"));
    expect(result.current[0]).toBe("light");
    expect(localStorage.getItem("volleycoach-theme")).toBeNull();
  });
});
