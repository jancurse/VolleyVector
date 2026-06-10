import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useSidebarMode } from "../../src/shell/useSidebarMode";
import { setViewportWidth } from "../helpers/viewport";

describe("useSidebarMode", () => {
  test.each([
    [1920, "full"],
    [1400, "full"],
    [1399, "rail"],
    [960, "rail"],
    [959, "drawer"],
  ])("a %ipx viewport resolves to %s", (width, mode) => {
    act(() => setViewportWidth(width));

    const { result } = renderHook(() => useSidebarMode());

    expect(result.current).toBe(mode);
  });

  test("reacts to a viewport change", () => {
    const { result } = renderHook(() => useSidebarMode());

    expect(result.current).toBe("full");

    act(() => setViewportWidth(700));
    expect(result.current).toBe("drawer");

    act(() => setViewportWidth(1200));
    expect(result.current).toBe("rail");
  });
});
