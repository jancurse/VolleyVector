// Temporary placeholder to give src/ a real, lintable source file before phase 1.
// Replace with the court coordinate utilities once phase 1 begins.

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
