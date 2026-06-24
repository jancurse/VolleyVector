import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useCopyLabel } from "../../src/ui/useCopyLabel";

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => vi.useRealTimers());

describe("useCopyLabel", () => {
  test("writes the text, flips copied, then clears it after 1500ms", async () => {
    const { result } = renderHook(() => useCopyLabel());

    expect(result.current.copied).toBe(false);

    await act(async () => result.current.copy("hello"));
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1499));
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.copied).toBe(false);
  });

  test("reset clears the confirmation immediately", async () => {
    const { result } = renderHook(() => useCopyLabel());

    await act(async () => result.current.copy("hello"));
    expect(result.current.copied).toBe(true);

    act(() => result.current.reset());
    expect(result.current.copied).toBe(false);
  });

  test("a rejected clipboard write leaves copied false", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { result } = renderHook(() => useCopyLabel());

    await act(async () => result.current.copy("hello"));
    expect(result.current.copied).toBe(false);
  });
});
