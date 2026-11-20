import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { AppShell } from "../../src/shell/AppShell";

describe("AppShell", () => {
  test.each([
    { bare: false, chrome: true },
    { bare: true, chrome: false },
  ])("bare ($bare) decides whether the sidebar and top bar show around the content", ({ bare, chrome }) => {
    render(
      <AppShell mode="full" bare={bare} sidebar={<nav aria-label="Sidebar" />} topBar={<header>Top bar</header>}>
        <p>Content</p>
      </AppShell>
    );

    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Sidebar" }) !== null).toBe(chrome);
    expect(screen.queryByText("Top bar") !== null).toBe(chrome);
  });
});
