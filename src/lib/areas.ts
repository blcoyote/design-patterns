export type Area = "patterns" | "architecture" | "compare";

/** Which of the three top-level areas a route belongs to. Replaces the old boolean
 * `inArchitectureArea` now that there are three areas instead of two. */
export function areaOf(pathname: string): Area {
  if (pathname.startsWith("/architecture")) return "architecture";
  if (pathname.startsWith("/compare")) return "compare";
  return "patterns";
}
