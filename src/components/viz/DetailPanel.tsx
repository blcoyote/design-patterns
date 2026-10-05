import { motion } from "motion/react";
import { Link } from "react-router-dom";
import type { Selection } from "@/lib/selection";
import type { ExplorableDefinition, Relation } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

const RELATION_NAMES: Record<Relation["type"], string> = {
  calls: "Calls",
  creates: "Creates",
  implements: "Implements",
  wraps: "Wraps",
  notifies: "Notifies",
  holds: "Holds a reference to",
};

/** Resolves a design-pattern slug to a "Built with" chip. Kept as a prop so the patterns
 * registry never has to import architecture code (see `lib/crossRefs`). */
export type ResolvePattern = (
  slug: string,
) => { name: string; href: string; color: string } | undefined;

interface Props {
  pattern: ExplorableDefinition;
  selection: Selection | null;
  color: string;
  onSelect: (id: string | null) => void;
  // @pattern dependency-injection: the resolver is passed in, so the patterns side never imports the architectures side
  resolvePattern?: ResolvePattern;
}

export function DetailPanel({ pattern, selection, color, onSelect, resolvePattern }: Props) {
  const name = (id: string) => pattern.participants.find((p) => p.id === id)?.label ?? id;
  const connections =
    selection?.kind === "participant"
      ? pattern.relations.filter((r) => r.from === selection.item.id || r.to === selection.item.id)
      : [];

  return (
    <div className="min-h-44 rounded-xl bg-surface/70 p-5 ring-1 ring-line">
      {!selection ? (
        <motion.div
          key="hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-fg-muted"
        >
          <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle">Explore</p>
          <p className="mt-2">
            <span className="font-semibold text-fg-body">Click any box or arrow</span> in the
            diagram to see what it does and where it lives in the code.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {pattern.participants.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="rounded-full px-3 py-1 text-xs text-fg-soft ring-1 ring-line-strong transition hover:bg-surface-raised hover:text-fg"
              >
                {p.label}
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <motion.div
          key={selection.item.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider" style={{ color }}>
                {selection.kind === "participant"
                  ? selection.item.role
                  : `${RELATION_NAMES[selection.item.type]} · relationship`}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-fg">
                {selection.kind === "participant" ? (
                  selection.item.label
                ) : (
                  <>
                    {name(selection.item.from)} <span className="text-fg-subtle">→</span>{" "}
                    {name(selection.item.to)}
                  </>
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Clear selection"
              className="rounded-md p-1 text-fg-subtle hover:bg-surface-raised hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="size-5 fill-current">
                <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
              </svg>
            </button>
          </div>
          <p className="mt-3 leading-relaxed text-fg-soft">{selection.item.description}</p>

          {connections.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
                Connections
              </p>
              <ul className="mt-2 space-y-1">
                {connections.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.id)}
                      className="text-left text-sm text-fg-soft hover:text-fg"
                    >
                      <span className="font-mono text-fg-subtle">{r.type}</span> {name(r.from)} →{" "}
                      {name(r.to)}
                      {r.label && <span className="font-mono text-fg-subtle"> · {r.label}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selection.kind === "participant" &&
            selection.item.patterns &&
            selection.item.patterns.length > 0 &&
            resolvePattern && (
              <div className="mt-4">
                <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
                  Built with
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selection.item.patterns.map((slug) => {
                    const resolved = resolvePattern(slug);
                    if (!resolved) return null;
                    return (
                      <Link
                        key={slug}
                        to={resolved.href}
                        className="rounded-full px-3 py-1 text-xs font-medium transition hover:bg-surface-raised"
                        style={{
                          color: resolved.color,
                          boxShadow: `inset 0 0 0 1px ${alpha(resolved.color, 33)}`,
                        }}
                      >
                        {resolved.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
        </motion.div>
      )}
    </div>
  );
}
