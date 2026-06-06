// Vitest global setup: registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
import "@testing-library/jest-dom";

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
