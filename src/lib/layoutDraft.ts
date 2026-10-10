import { emptyLayout, isEmpty, type LayoutOverrides } from "@/lib/layoutEdit";
import type { ExplorableDefinition } from "@/types/pattern";

const PARTICIPANT_FIELDS = ["x", "y", "width"] as const;

/** localStorage key of the unsaved layout draft of one pattern or architecture. */
export function layoutDraftKey(area: string, slug: string): string {
  return `dev-layout:${area}/${slug}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Turns stored JSON text into overrides for `definition`. Anything malformed is dropped rather
 * than trusted: unparsable text, non-numeric values, unknown fields, and ids that no longer
 * exist in the definition.
 */
export function parseLayoutDraft(
  raw: string | null,
  definition: Pick<ExplorableDefinition, "participants" | "relations">,
): LayoutOverrides {
  const out = emptyLayout();
  if (raw === null) return out;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!isRecord(data)) return out;

  const { participants, relations } = data;
  if (isRecord(participants)) {
    for (const { id } of definition.participants) {
      const stored = participants[id];
      if (!isRecord(stored)) continue;
      const patch: LayoutOverrides["participants"][string] = {};
      for (const field of PARTICIPANT_FIELDS) {
        const value = stored[field];
        if (typeof value === "number" && Number.isFinite(value)) patch[field] = value;
      }
      if (Object.keys(patch).length > 0) out.participants[id] = patch;
    }
  }
  if (isRecord(relations)) {
    for (const { id } of definition.relations) {
      const stored = relations[id];
      if (!isRecord(stored)) continue;
      const bend = stored.bend;
      if (typeof bend === "number" && Number.isFinite(bend)) out.relations[id] = { bend };
    }
  }
  return out;
}

/** localStorage, or `null` where it is missing or throws on access (private mode, blocked, tests). */
function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** The stored draft for this subject, filtered to ids `definition` still has; empty when none. */
export function loadLayoutDraft(
  area: string,
  slug: string,
  definition: Pick<ExplorableDefinition, "participants" | "relations">,
): LayoutOverrides {
  try {
    return parseLayoutDraft(storage()?.getItem(layoutDraftKey(area, slug)) ?? null, definition);
  } catch {
    return emptyLayout();
  }
}

/** Stores the draft, or removes the entry when there is nothing to keep. Never throws. */
export function saveLayoutDraft(area: string, slug: string, overrides: LayoutOverrides): void {
  try {
    const store = storage();
    if (!store) return;
    const key = layoutDraftKey(area, slug);
    if (isEmpty(overrides)) store.removeItem(key);
    else store.setItem(key, JSON.stringify(overrides));
  } catch {
    // storage unavailable or full: the draft only lives in memory
  }
}
