import { motion, useReducedMotion } from 'motion/react'
import { Diagram } from '@/components/viz/Diagram'
import type { VisualizationProps } from '@/types/pattern'

const CENTER = { x: 400, y: 230 }
const CORE_RADIUS = 92
const SHELL_RADIUS = 200

/**
 * Functional Core / Imperative Shell draws the pure core as an inner circle and the
 * imperative shell — HTTP handler, clock, account store, mailer — as a ring around
 * it. The core gets a soft pulsing outline while the "decide" step is active, a
 * small nod to it being a pure calculation rather than an I/O call. The final step
 * draws the test harness calling straight into the core, cutting across the ring
 * entirely — the payoff of keeping the core free of side effects.
 */
export function FunctionalCoreVisualization({ pattern, color, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const reduceMotion = !!useReducedMotion()

  // Only pulse on the step that is specifically "about" the core deciding — not the
  // wide overview step, and not steps where the shell is interpreting effects.
  const corePulsing = !!step?.highlight.includes('core') && step.highlight.includes('decide')

  const underlay = (
    <g pointerEvents="none">
      <circle cx={CENTER.x} cy={CENTER.y} r={SHELL_RADIUS} fill="none" stroke="#1e293b" strokeWidth={2} strokeDasharray="6 6" />
      <circle cx={CENTER.x} cy={CENTER.y} r={CORE_RADIUS} fill="#0f172a" opacity={0.65} stroke="#1e293b" strokeWidth={2} />
      <text
        x={CENTER.x}
        y={CENTER.y - SHELL_RADIUS + 20}
        textAnchor="middle"
        className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase select-none"
      >
        Imperative shell
      </text>
      <text
        x={CENTER.x}
        y={CENTER.y + CORE_RADIUS - 14}
        textAnchor="middle"
        className="fill-slate-600 text-[10px] font-mono tracking-wider uppercase select-none"
      >
        pure core
      </text>
    </g>
  )

  const overlay = corePulsing ? (
    <motion.circle
      cx={CENTER.x}
      cy={CENTER.y}
      r={CORE_RADIUS}
      fill="none"
      stroke={color}
      strokeWidth={2}
      pointerEvents="none"
      style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
      initial={{ opacity: 0.7, scale: 1 }}
      animate={reduceMotion ? { opacity: 0.7, scale: 1 } : { opacity: [0.7, 0, 0.7], scale: [1, 1.2, 1] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
    />
  ) : undefined

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
