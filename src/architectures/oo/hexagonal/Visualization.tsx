import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { boxOf, edgeBetween } from '@/lib/geometry'
import type { Step, VisualizationProps } from '@/types/pattern'

/**
 * Hexagonal keeps the data-driven diagram, but adds an underlay drawing the
 * hexagon outline around the core plus "driving" / "driven" side labels, so
 * the ports-on-the-edges shape reads at a glance. A "Try it" row lets the
 * visitor plug either driven adapter into OrderRepository themselves,
 * independent of the step player — the payoff the final step describes.
 */

const HEX_CENTER = { x: 400, y: 230 }
const HEX_RADIUS = 195

function hexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

type AdapterId = 'postgresAdapter' | 'inMemoryAdapter'

/** Which driven adapter a step's highlight set is "about". */
function adapterFromStep(step: Step | null): AdapterId {
  if (step?.highlight.includes('inMemoryAdapter') && step.highlight.includes('memSave')) return 'inMemoryAdapter'
  return 'postgresAdapter'
}

function syntheticStep(id: AdapterId): Step {
  const isMemory = id === 'inMemoryAdapter'
  return {
    title: isMemory ? 'Plugged in: InMemoryOrderRepository' : 'Plugged in: PostgresOrderRepository',
    description: isMemory
      ? 'The driven port now points at the in-memory adapter. PlaceOrderService and Order were never touched.'
      : 'The driven port points back at the real database adapter. Same core, same port, different adapter.',
    highlight: isMemory
      ? ['testHarness', 'reqTest', 'placeOrderPort', 'orderRepoPort', 'memSave', 'inMemoryAdapter']
      : ['httpController', 'reqHttp', 'placeOrderPort', 'orderRepoPort', 'pgQuery', 'postgresAdapter'],
    packets: isMemory ? [{ relation: 'memSave', label: 'saved.push(order)' }] : [{ relation: 'pgQuery', label: 'INSERT INTO orders …' }],
    notes: isMemory ? { inMemoryAdapter: 'swapped in' } : { postgresAdapter: 'swapped in' },
  }
}

export function HexagonalVisualization({ pattern, color, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const reduceMotion = !!useReducedMotion()
  // Tag the override with the step it was picked on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [pickedOverride, setPickedOverride] = useState<{ forStep: number; id: AdapterId } | null>(null)
  const [replayToken, setReplayToken] = useState(0)
  const override = pickedOverride?.forStep === stepIndex ? pickedOverride.id : null

  const byId = useMemo(() => new Map(pattern.participants.map((p) => [p.id, p])), [pattern.participants])

  const effectiveStep = override ? syntheticStep(override) : step
  const activeId = override ?? adapterFromStep(step)
  const animationKey = override ? `override-${override}-${replayToken}` : stepIndex

  const repoPort = byId.get('orderRepoPort')
  const activeAdapter = byId.get(activeId)
  const connector = repoPort && activeAdapter ? edgeBetween(boxOf(repoPort), boxOf(activeAdapter)) : null

  const springTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 220, damping: 24 }

  function pick(id: AdapterId) {
    setPickedOverride({ forStep: stepIndex, id })
    setReplayToken((t) => t + 1)
    onSelect(id)
  }

  const underlay = (
    <g pointerEvents="none">
      <polygon
        points={hexagonPoints(HEX_CENTER.x, HEX_CENTER.y, HEX_RADIUS)}
        fill="#0f172a"
        fillOpacity={0.35}
        stroke="#334155"
        strokeWidth={1.5}
        strokeDasharray="3 5"
      />
      <text x={HEX_CENTER.x} y={HEX_CENTER.y - HEX_RADIUS + 24} textAnchor="middle" className="fill-slate-500 text-[11px] font-mono tracking-wider uppercase select-none">
        Core (application + domain)
      </text>
      <text x={40} y={24} className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase select-none">
        ← Driving adapters
      </text>
      <text x={760} y={24} textAnchor="end" className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase select-none">
        Driven adapters →
      </text>
    </g>
  )

  const overlay = repoPort && activeAdapter && connector && (
    <motion.g pointerEvents="none">
      <motion.path
        d={connector.d}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.85}
        filter="url(#glow)"
        initial={false}
        animate={{ d: connector.d }}
        transition={springTransition}
      />
      <motion.circle r={5} fill="#ffffff" initial={false} animate={{ cx: connector.start.x, cy: connector.start.y }} transition={springTransition} />
      <motion.circle r={5} fill={color} initial={false} animate={{ cx: connector.end.x, cy: connector.end.y }} transition={springTransition} />
    </motion.g>
  )

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={effectiveStep?.highlight}
        packets={effectiveStep?.packets}
        notes={effectiveStep?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        underlay={underlay}
        overlay={overlay}
        ariaLabel={`${pattern.name} diagram`}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">Plug into OrderRepository</span>
        {(
          [
            { id: 'postgresAdapter' as const, label: 'PostgresOrderRepository' },
            { id: 'inMemoryAdapter' as const, label: 'InMemoryOrderRepository' },
          ]
        ).map(({ id, label }) => {
          const isActive = activeId === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              aria-label={`Plug in ${label}`}
              onClick={(e) => {
                e.stopPropagation()
                pick(id)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
                isActive ? 'text-slate-950 ring-transparent' : 'text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: color } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
