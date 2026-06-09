import { describe, expect, test } from "vitest";

import { inviteLandingFromHash } from "../../src/auth/inviteLanding";

describe("inviteLandingFromHash", () => {
  test.each([
    ["#access_token=abc&type=invite", true],
    ["#type=invite&refresh_token=xyz", true],
    ["", false],
    ["#access_token=abc&type=recovery", false],
    ["#access_token=abc", false],
    ["#/invite/some-token", false],
    ["#/share/some-token", false],
  ])("%s -> %s", (hash, expected) => {
    expect(inviteLandingFromHash(hash)).toBe(expected);
  });
});
