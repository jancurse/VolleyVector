import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useBoardPlayback } from "../../src/boards/useBoardPlayback";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useBoardPlayback", () => {
  test("steps forward and back, clamped to the ends", () => {
    const { result } = renderHook(() => useBoardPlayback(3));

    expect(result.current.step).toBe(0);
    expect(result.current.atEnd).toBe(false);

    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.step).toBe(2);
    expect(result.current.atEnd).toBe(true);

    act(() => result.current.next());
    expect(result.current.step).toBe(2); // clamped at the last step

    act(() => result.current.prev());
    expect(result.current.step).toBe(1);

    act(() => result.current.goTo(99));
    expect(result.current.step).toBe(2); // clamped
  });

  // One ADVANCE_MS (700ms travel + 1100ms dwell) is 1800ms; 2000 fires exactly one advance.
  const ONE_ADVANCE = 2000;

  test("advances one step on the clock while playing", () => {
    const { result } = renderHook(() => useBoardPlayback(3));

    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(ONE_ADVANCE));

    expect(result.current.step).toBe(1);
    expect(result.current.playing).toBe(true);
  });

  test("stops playing once it reaches the last step", () => {
    const { result } = renderHook(() => useBoardPlayback(2));

    act(() => result.current.play());
    act(() => vi.advanceTimersByTime(ONE_ADVANCE));

    expect(result.current.step).toBe(1);
    expect(result.current.playing).toBe(false);
  });

  test("playing from the end replays from the first step", () => {
    const { result } = renderHook(() => useBoardPlayback(2));

    act(() => result.current.goTo(1));
    expect(result.current.atEnd).toBe(true);

    act(() => result.current.play());
    expect(result.current.step).toBe(0);
    expect(result.current.playing).toBe(true);

    act(() => result.current.pause());
    expect(result.current.playing).toBe(false);
  });
});
