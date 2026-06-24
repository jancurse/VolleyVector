import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { useHashMatch, useHashToken } from "../../src/routing/useHashRoute";

function setHash(hash: string): void {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

afterEach(() => {
  window.location.hash = "";
});

describe("useHashToken", () => {
  test.each([
    ["#/share/abc", "#/share/", "abc"],
    ["#/grant/xyz", "#/grant/", "xyz"],
    ["#/invite/tok", "#/invite/", "tok"],
    ["#/share/a%20b", "#/share/", "a b"],
    ["#/share/", "#/share/", ""],
    ["#/grant/abc", "#/share/", null],
    ["", "#/share/", null],
  ])("hash %s with prefix %s yields %s", (hash, prefix, expected) => {
    window.location.hash = hash;

    const { result } = renderHook(() => useHashToken(prefix));

    expect(result.current).toBe(expected);
  });

  test("reacts to a hash change", () => {
    const { result } = renderHook(() => useHashToken("#/share/"));

    expect(result.current).toBeNull();

    setHash("#/share/abc");
    expect(result.current).toBe("abc");

    setHash("#/grant/xyz");
    expect(result.current).toBeNull();
  });
});

describe("useHashMatch", () => {
  test.each([
    ["#/preview", "#/preview", true],
    ["#/preview/extra", "#/preview", false],
    ["", "#/preview", false],
  ])("hash %s against %s yields %s", (hash, target, expected) => {
    window.location.hash = hash;

    const { result } = renderHook(() => useHashMatch(target));

    expect(result.current).toBe(expected);
  });

  test("reacts to a hash change", () => {
    const { result } = renderHook(() => useHashMatch("#/preview"));

    expect(result.current).toBe(false);

    setHash("#/preview");
    expect(result.current).toBe(true);

    setHash("#/library");
    expect(result.current).toBe(false);
  });
});
