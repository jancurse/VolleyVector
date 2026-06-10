// happy-dom exposes viewport control on window.happyDOM, untyped by the DOM lib; declared here once
// so tests resize without casts.
declare global {
  interface Window {
    happyDOM?: { setViewport(viewport: { width?: number; height?: number }): void };
  }
}

/** Resize the happy-dom viewport so media queries and resize listeners re-evaluate. */
export function setViewportWidth(width: number): void {
  window.happyDOM?.setViewport({ width });
}
