import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BrandLockup, BrandMark } from "../../src/shell/BrandMark";

// The mark is a decorative glyph: the lockup's wordmark carries the accessible name, so the mark's own
// structure (size, theme-aware strokes, constant accent) is asserted directly for want of an a11y handle.
describe("BrandMark", () => {
  test.each<[number | undefined, number]>([
    [undefined, 22],
    [40, 40],
  ])("renders an svg sized to the size prop (%s)", (size, expected) => {
    const { container } = render(<BrandMark size={size} />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("width", String(expected));
    expect(svg).toHaveAttribute("height", String(expected));
  });

  test("draws the court in the current colour with a constant amber ball", () => {
    const { container } = render(<BrandMark />);

    expect(container.querySelector('[stroke="currentColor"]')).toBeInTheDocument();
    expect(container.querySelector('[fill="#e8973a"]')).toBeInTheDocument();
  });
});

describe("BrandLockup", () => {
  test("pairs the mark with the VolleyCoach wordmark", () => {
    const { container } = render(<BrandLockup />);

    expect(screen.getByText("VolleyCoach")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
