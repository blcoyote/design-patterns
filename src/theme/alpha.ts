/**
 * `color` at `percent` opacity (0–100), as a CSS `color-mix()`. Works for hex and
 * `var(--color-…)` alike, which is why it replaces appending two hex digits
 * (`${color}22`) — that only works while `color` is a 6-digit hex string.
 */
export function alpha(color: string, percent: number): string {
  if (!(percent >= 0 && percent <= 100)) {
    throw new RangeError(`alpha percent must be between 0 and 100, got ${percent}`);
  }
  return `color-mix(in oklab, ${color} ${+percent.toFixed(2)}%, transparent)`;
}
