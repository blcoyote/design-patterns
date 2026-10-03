import { motion, useReducedMotion } from 'motion/react'
import { Diagram } from '@/components/viz/Diagram'
import type { VisualizationProps } from '@/types/pattern'

/**
 * MVU draws the generic participant diagram on top of a faint underlay: the
 * Model → View → Msg → Update cycle as a dashed band running behind the boxes,
 * split into a "pure" zone (update/view, top-right and bottom-right) and a
 * "runtime / effects" zone (everything the Runtime itself touches, left and
 * centre). A small arrowhead creeps around the band to the step that is
 * currently active, echoing the one-way loop the whole pattern is built on.
 */

const CYCLE = [
  { x: 90, y: 230 }, // msg
  { x: 330, y: 150 }, // runtime
  { x: 570, y: 70 }, // update
  { x: 570, y: 230 }, // history
  { x: 330, y: 330 }, // effects
  { x: 570, y: 390 }, // view
  { x: 90, y: 390 }, // subs
  { x: 90, y: 230 }, // back to msg
]

/** Which point along CYCLE the loop marker sits at for each step (0-indexed, aligned with pattern.steps). */
const MARKER_BY_STEP = [0, 0, 1, 2, 3, 4, 5, 6, 0]

function pathD() {
  return CYCLE.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function pointAt(t: number) {
  const segments = CYCLE.length - 1
  const pos = t * segments
  const i = Math.min(Math.floor(pos), segments - 1)
  const frac = pos - i
  const a = CYCLE[i]
  const b = CYCLE[i + 1]
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }
}

export function MvuVisualization({ pattern, color, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const reduceMotion = !!useReducedMotion()
  const idx = Math.min(stepIndex, MARKER_BY_STEP.length - 1)
  const markerT = MARKER_BY_STEP[idx] / (CYCLE.length - 1)
  const marker = pointAt(markerT)

  const underlay = (
    <g pointerEvents="none">
      <path d={pathD()} fill="none" stroke="#1e293b" strokeWidth={2} strokeDasharray="6 6" />

      {/* Pure zone: update() and view() live on the right, free of I/O. */}
      <rect x={470} y={20} width={220} height={120} rx={10} fill="none" stroke="#1e293b" strokeDasharray="3 5" />
      <text x={580} y={14} textAnchor="middle" className="fill-slate-600 text-[10px] font-mono tracking-wider uppercase select-none">
        pure
      </text>
      <rect x={470} y={340} width={220} height={110} rx={10} fill="none" stroke="#1e293b" strokeDasharray="3 5" />
      <text x={580} y={460 - 6} textAnchor="middle" className="fill-slate-600 text-[10px] font-mono tracking-wider uppercase select-none">
        pure
      </text>

      {/* Runtime / effects zone: everything the Runtime touches directly. */}
      <rect x={20} y={100} width={420} height={280} rx={10} fill="none" stroke="#1e293b" strokeDasharray="3 5" />
      <text x={30} y={118} className="fill-slate-600 text-[10px] font-mono tracking-wider uppercase select-none">
        runtime / effects
      </text>
    </g>
  )

  const overlay = (
    <motion.g pointerEvents="none" style={{ transformOrigin: `${marker.x}px ${marker.y}px` }}>
      <motion.circle
        cx={marker.x}
        cy={marker.y}
        r={7}
        fill={color}
        initial={false}
        animate={reduceMotion ? { opacity: 0.9 } : { opacity: [0.5, 1, 0.5] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.g>
  )

  return (
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
      underlay={underlay}
      overlay={overlay}
      ariaLabel={`${pattern.name} diagram`}
    />
  )
}
