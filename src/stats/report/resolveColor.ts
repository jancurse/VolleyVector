/**
 * A CSS colour (a theme variable, a color-mix) as a concrete colour a canvas can draw, resolved inside `el` so it
 * follows that element's theme.
 */
export function resolveColor(el: Element, css: string): string {
  if (!css.includes("var(") && !css.includes("color-mix(")) return css;

  const probe = document.createElement("i");

  probe.style.color = css;
  probe.hidden = true;
  el.appendChild(probe);

  const color = getComputedStyle(probe).color;

  probe.remove();

  return color;
}
