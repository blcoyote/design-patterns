import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Diagram } from '@/components/viz/Diagram'
import { onActivate } from '@/lib/a11y'
import { categories } from '@/patterns/categories'
import type { VisualizationProps } from '@/types/pattern'

/**
 * Flyweight: the generic diagram up top shows the structural roles (Forest, Tree,
 * TreeTypeFactory, TreeType, ConcreteTreeType, Canvas). Below it, a "rendered forest"
 * panel grows a scatter of tiny tree glyphs — one per planted Tree — colored by which
 * of only two shared ConcreteTreeType instances they point at, next to a live
 * instances/shared-types/memory-saved readout that updates with each step.
 */

type Species = 'oak' | 'pine'

const SPECIES_COLOR: Record<Species, string> = { oak: '#4ade80', pine: '#0d9488' }
const SPECIES_LABEL: Record<Species, string> = { oak: 'Oak', pine: 'Pine' }

/** How many Tree glyphs are drawn, and how many distinct TreeTypes exist, at each step. */
const DOT_COUNTS = [0, 0, 0, 1, 2, 2, 60, 60]
const TYPE_COUNTS = [0, 0, 1, 1, 1, 2, 2, 2]
/** The narrative instance count used for the memory readout (the dots above are capped for rendering). */
const NARRATIVE_COUNTS = [0, 0, 0, 1, 2, 2, 5000, 5000]

const INTRINSIC_BYTES = 2458 // a plausible size for one cached texture + mesh
const EXTRINSIC_BYTES = 24 // x, y, age — three numbers

const PLOT = { width: 700, height: 140 }

/** Deterministic pseudo-random generator so the scatter layout never reshuffles on re-render. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MAX_TREES = Math.max(...DOT_COUNTS)
const TREE_SPOTS = (() => {
  const rand = mulberry32(42)
  return Array.from({ length: MAX_TREES }, () => ({
    x: 24 + rand() * (PLOT.width - 48),
    y: 18 + rand() * (PLOT.height - 36),
  }))
})()

/** The first two trees are the Oaks the steps narrate by name; everything after alternates species. */
function speciesForIndex(i: number): Species {
  if (i < 2) return 'oak'
  return i % 2 === 0 ? 'oak' : 'pine'
}

export function FlyweightVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = !!useReducedMotion()

  const idx = Math.min(stepIndex, DOT_COUNTS.length - 1)
  const dotCount = DOT_COUNTS[idx]
  const typeCount = TYPE_COUNTS[idx]
  const instanceCount = NARRATIVE_COUNTS[idx]

  const withoutFlyweight = instanceCount * (INTRINSIC_BYTES + EXTRINSIC_BYTES)
  const withFlyweight = typeCount * INTRINSIC_BYTES + instanceCount * EXTRINSIC_BYTES
  const savedPct = instanceCount > 0 ? Math.round((1 - withFlyweight / withoutFlyweight) * 100) : 0

  const highlight = step?.highlight ?? []
  const treeActive = highlight.some((id) => ['tree', 'plant-tree', 'tree-holds', 'tree-draw'].includes(id))
  const typeActive = highlight.some((id) =>
    ['concreteType', 'treeType', 'factory-create', 'concrete-implements', 'tree-draw', 'type-paint'].includes(id),
  )
  const factoryActive = highlight.some((id) => ['factory', 'request-type', 'factory-create'].includes(id))

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={step?.highlight}
        packets={step?.packets}
        notes={step?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={stepIndex}
        ariaLabel={`${pattern.name} diagram`}
      />

      <div className="flex flex-wrap items-stretch gap-3 border-t border-slate-800 p-3">
        <svg
          viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
          className="h-auto min-w-[260px] flex-1 cursor-pointer rounded-lg bg-slate-950/40 outline-none ring-1 ring-slate-800"
          role="button"
          tabIndex={0}
          aria-label={`Rendered forest — ${instanceCount.toLocaleString()} Tree instances sharing ${typeCount} TreeType objects`}
          aria-pressed={selectedId === 'tree'}
          onClick={(e) => {
            e.stopPropagation()
            onSelect('tree')
          }}
          onKeyDown={onActivate(() => onSelect('tree'))}
        >
          <rect
            x={1}
            y={1}
            width={PLOT.width - 2}
            height={PLOT.height - 2}
            rx={10}
            fill="none"
            stroke={treeActive || selectedId === 'tree' ? color : 'transparent'}
            strokeWidth={2}
          />
          <text x={12} y={18} className="fill-slate-500 text-[10px] font-mono select-none">
            forest render
          </text>
          <AnimatePresence>
            {TREE_SPOTS.slice(0, dotCount).map((spot, i) => {
              const species = speciesForIndex(i)
              const fill = SPECIES_COLOR[species]
              return (
                <motion.circle
                  key={i}
                  cx={spot.x}
                  cy={spot.y}
                  r={5}
                  fill={fill}
                  fillOpacity={0.85}
                  stroke={fill}
                  strokeWidth={1}
                  initial={reduceMotion ? { opacity: 0.85, scale: 1 } : { opacity: 0, scale: 0.2 }}
                  animate={{ opacity: 0.85, scale: 1 }}
                  transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 360, damping: 20, delay: Math.min(i, 24) * 0.01 }}
                />
              )
            })}
          </AnimatePresence>
        </svg>

        <div className="flex min-w-[200px] flex-col justify-between gap-2 rounded-lg bg-slate-950/40 p-3 ring-1 ring-slate-800">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Tree instances</span>
            <span className="font-mono text-sm font-bold" style={{ color: treeActive ? color : '#e2e8f0' }}>
              {instanceCount.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center justify-between gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-pressed={selectedId === 'factory'}
            onClick={(e) => {
              e.stopPropagation()
              onSelect('factory')
            }}
          >
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Shared TreeTypes</span>
            <span className="font-mono text-sm font-bold" style={{ color: factoryActive ? color : '#e2e8f0' }}>
              {typeCount}
            </span>
          </button>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Memory saved</span>
            <span className="font-mono text-sm font-bold" style={{ color: instanceCount > 0 ? color : '#64748b' }}>
              {savedPct}%
            </span>
          </div>
          <div className="mt-1 flex gap-2 border-t border-slate-800 pt-2">
            {(['oak', 'pine'] as const).map((species) => (
              <button
                key={species}
                type="button"
                aria-label={`${SPECIES_LABEL[species]} TreeType`}
                aria-pressed={selectedId === 'concreteType'}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect('concreteType')
                }}
                className="flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-slate-300 outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-white"
                style={typeActive ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SPECIES_COLOR[species] }} />
                {SPECIES_LABEL[species]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
