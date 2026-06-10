import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumb } from "../../src/shell/Breadcrumb";
import type { Crumb } from "../../src/shell/breadcrumb";

// The trail's middle folds behind an ellipsis menu once it outgrows four crumbs; the hidden crumbs stay
// reachable through the menu. Each crumb gets a distinct route so a pick can be told apart.
const crumbs: Crumb[] = ["Falcons", "Attack", "Tempo", "Quick", "Slide", "Quick set"].map((label) => ({
  label,
  route: { kind: "topic", space: { kind: "personal" }, topicSlug: label },
}));

describe("Breadcrumb", () => {
  it("links earlier crumbs and ends in the current page as text", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<Breadcrumb crumbs={crumbs.slice(0, 3)} onNavigate={onNavigate} />);

    expect(screen.getByText("Tempo")).not.toHaveRole("button");

    await user.click(screen.getByRole("button", { name: "Attack" }));

    expect(onNavigate).toHaveBeenCalledWith(crumbs[1].route);
  });

  it("folds a long trail's middle into a menu that still navigates", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();

    render(<Breadcrumb crumbs={crumbs} onNavigate={onNavigate} />);

    // The middle crumbs are folded away; head and tail stay visible.
    expect(screen.queryByText("Tempo")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Falcons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Slide" })).toBeInTheDocument();
    expect(screen.getByText("Quick set")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More pages" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tempo" }));

    expect(onNavigate).toHaveBeenCalledWith(crumbs[2].route);
  });
});
