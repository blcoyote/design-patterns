/**
 * Parses a `?step=N` deep-link query param into a valid 0-based step index. Returns `undefined`
 * (meaning: no deep link, play normally) for a missing, non-numeric or negative value; a value
 * past the last step is clamped instead of ignored, so a stale link still lands somewhere sane.
 */
export function parseStepParam(value: string | null, stepCount: number): number | undefined {
  if (value === null) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) return undefined
  return Math.min(n, Math.max(0, stepCount - 1))
}
