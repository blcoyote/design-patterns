import type { LayoutWarning } from "@/lib/layoutLint";

interface LayoutLintPanelProps {
  warnings: LayoutWarning[];
  /** A warning was clicked: the page selects (and thereby outlines) what it involves. */
  onSelect: (warning: LayoutWarning) => void;
}

/** The layout lint warnings for the diagram being edited, recomputed by the page on every edit. */
export function LayoutLintPanel({ warnings, onSelect }: LayoutLintPanelProps) {
  return (
    <section aria-label="Layout warnings" className="space-y-2">
      <h2 className="text-sm font-semibold text-fg">
        Layout warnings{" "}
        <span className="font-mono font-normal text-fg-subtle" data-testid="lint-count">
          ({warnings.length})
        </span>
      </h2>
      {warnings.length === 0 ? (
        <p className="text-sm text-fg-muted">No layout problems found.</p>
      ) : (
        <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-card ring-1 ring-control-outline">
          {warnings.map((w) => (
            <li key={`${w.rule}|${w.participantIds.join(",")}|${w.relationIds.join(",")}`}>
              <button
                type="button"
                data-rule={w.rule}
                onClick={() => onSelect(w)}
                className="flex w-full flex-col gap-1 px-3 sm:flex-row sm:items-baseline sm:gap-3 py-2 text-left transition hover:bg-surface-raised"
              >
                <span className="shrink-0 sm:w-52 font-mono text-xs text-editor-warn">
                  {w.severity === "error" ? "error" : "warn"} · {w.rule}
                </span>
                <span className="text-sm text-fg-body">{w.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
