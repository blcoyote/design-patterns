import { boxOf } from "@/lib/geometry";
import type { LayoutOverrides } from "@/lib/layoutEdit";
import type { ExplorableDefinition } from "@/types/pattern";

/** One row of the editor's change list: everything changed on a single participant or relation. */
export interface LayoutChange {
  kind: "participant" | "relation";
  id: string;
  /** e.g. `participant observer: x 400 -> 420, y 70 -> 90` */
  text: string;
}

/**
 * Human-readable rows for a diff (as produced by `diffLayout(original, edited)`), in the
 * definition's own order. Ids missing from `original` are skipped.
 */
export function describeChanges(
  original: Pick<ExplorableDefinition, "participants" | "relations">,
  diff: LayoutOverrides,
): LayoutChange[] {
  const rows: LayoutChange[] = [];
  for (const p of original.participants) {
    const patch = diff.participants[p.id];
    if (!patch) continue;
    const parts: string[] = [];
    if (patch.x !== undefined) parts.push(`x ${p.x} -> ${patch.x}`);
    if (patch.y !== undefined) parts.push(`y ${p.y} -> ${patch.y}`);
    if (patch.width !== undefined) parts.push(`width ${boxOf(p).width} -> ${patch.width}`);
    if (parts.length > 0) {
      rows.push({
        kind: "participant",
        id: p.id,
        text: `participant ${p.id}: ${parts.join(", ")}`,
      });
    }
  }
  for (const r of original.relations) {
    const patch = diff.relations[r.id];
    if (patch?.bend === undefined) continue;
    rows.push({
      kind: "relation",
      id: r.id,
      text: `relation ${r.id}: bend ${r.bend ?? 0} -> ${patch.bend}`,
    });
  }
  return rows;
}
