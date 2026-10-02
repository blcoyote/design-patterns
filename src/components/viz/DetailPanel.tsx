import { AnimatePresence, motion } from 'motion/react'
import type { Selection } from '@/lib/selection'
import type { PatternDefinition, Relation } from '@/types/pattern'

const RELATION_NAMES: Record<Relation['type'], string> = {
  calls: 'Calls',
  creates: 'Creates',
  implements: 'Implements',
  wraps: 'Wraps',
  notifies: 'Notifies',
  holds: 'Holds a reference to',
}

interface Props {
  pattern: PatternDefinition
  selection: Selection | null
  color: string
  onSelect: (id: string | null) => void
}

export function DetailPanel({ pattern, selection, color, onSelect }: Props) {
  const name = (id: string) => pattern.participants.find((p) => p.id === id)?.label ?? id
  const connections =
    selection?.kind === 'participant'
      ? pattern.relations.filter((r) => r.from === selection.item.id || r.to === selection.item.id)
      : []

  return (
    <div className="min-h-44 rounded-xl bg-slate-900/70 p-5 ring-1 ring-slate-800">
      <AnimatePresence mode="wait">
        {!selection ? (
          <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-400">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Explore</p>
            <p className="mt-2">
              <span className="font-semibold text-slate-200">Click any box or arrow</span> in the diagram to see what it does and
              where it lives in the code.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {pattern.participants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className="rounded-full px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700 transition hover:bg-slate-800 hover:text-white"
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
                  {selection.kind === 'participant'
                    ? selection.item.role
                    : `${RELATION_NAMES[selection.item.type]} · relationship`}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">
                  {selection.kind === 'participant' ? (
                    selection.item.label
                  ) : (
                    <>
                      {name(selection.item.from)} <span className="text-slate-500">→</span> {name(selection.item.to)}
                    </>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onSelect(null)}
                aria-label="Clear selection"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" /></svg>
              </button>
            </div>
            <p className="mt-3 leading-relaxed text-slate-300">{selection.item.description}</p>

            {connections.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500">Connections</p>
                <ul className="mt-2 space-y-1">
                  {connections.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(r.id)}
                        className="text-left text-sm text-slate-300 hover:text-white"
                      >
                        <span className="font-mono text-slate-500">{r.type}</span> {name(r.from)} → {name(r.to)}
                        {r.label && <span className="font-mono text-slate-500"> · {r.label}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
