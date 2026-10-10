import type { LayoutChange } from "@/lib/layoutChanges";

interface LayoutChangeListProps {
  changes: LayoutChange[];
  onRevert: (change: LayoutChange) => void;
}

/** The pending layout changes, one row per participant or relation, each with its own revert. */
export function LayoutChangeList({ changes, onRevert }: LayoutChangeListProps) {
  return (
    <section aria-label="Changes" className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">
        Changes <span className="font-mono font-normal text-fg-subtle">({changes.length})</span>
      </h2>
      {changes.length === 0 ? (
        <p className="text-sm text-fg-muted">No changes yet. Drag a box to start.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card ring-1 ring-control-outline">
          {changes.map((change) => (
            <li
              key={`${change.kind}:${change.id}`}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span className="font-mono text-xs text-fg-body">{change.text}</span>
              <button
                type="button"
                aria-label={`Revert ${change.kind} ${change.id}`}
                onClick={() => onRevert(change)}
                className="shrink-0 rounded-control px-2 py-1 text-xs text-fg-soft ring-1 ring-control-outline transition hover:bg-surface-raised hover:text-fg"
              >
                Revert
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
