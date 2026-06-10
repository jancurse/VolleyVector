// Vitest global setup: registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

import { setViewportWidth } from "./helpers/viewport";

// happy-dom's default viewport is 1024px wide, which the shell reads as the icon-rail mode. The suite
// is written against the full sidebar, so pin a desktop width; responsive tests resize per test.
beforeEach(() => setViewportWidth(1920));

// Base UI's overlays (Select, Menu, Combobox, dialogs, tooltips) reach for browser APIs that happy-dom
// does not fully implement. Stub the few they need so the components mount and interact in tests.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
