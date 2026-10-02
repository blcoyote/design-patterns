import { motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { DEFAULT_VIEWBOX } from '@/components/viz/Diagram'
import { DiagramEdge, EdgeMarkers } from '@/components/viz/DiagramEdge'
import { DiagramNode } from '@/components/viz/DiagramNode'
import { onActivate } from '@/lib/a11y'
import { Packet } from '@/components/viz/Packet'
import { boxExit, edgeBetween, NODE_HEIGHT, NODE_WIDTH } from '@/lib/geometry'
import type { Box, EdgeGeometry, Point } from '@/lib/geometry'
import { categories } from '@/patterns/categories'
import type { Participant, Relation, VisualizationProps } from '@/types/pattern'

/**
 * The decorator stack drawn as literal, concentric rounded rectangles:
 * SugarDecorator ⊃ MilkDecorator ⊃ SimpleCoffee. A small UML strip on the
 * right shows the Coffee interface and the abstract CoffeeDecorator base.
 */

// --- Layout (viewBox 800 × 460) -------------------------------------------

const CX = 250
const CY = 265
/** x of the vertical "delegation" line that threads through the tops of every layer. */
const LINK_X = 300

const CORE = { width: 130, height: 84 }
const MILK = { width: 236, height: 172 }
const SUGAR = { width: 344, height: 258 }

const coreBox: Box = { x: CX, y: CY, width: CORE.width, height: CORE.height }
const milkBox: Box = { x: CX, y: CY, width: MILK.width, height: MILK.height }
const sugarBox: Box = { x: CX, y: CY, width: SUGAR.width, height: SUGAR.height }

const coreTop: Point = { x: LINK_X, y: CY - CORE.height / 2 }
const milkTop: Point = { x: LINK_X, y: CY - MILK.height / 2 }
const sugarTop: Point = { x: LINK_X, y: CY - SUGAR.height / 2 }
const callEntry: Point = { x: LINK_X, y: sugarTop.y - 6 }

const clientBox: Box = { x: 660, y: 92, width: NODE_WIDTH, height: NODE_HEIGHT }
const coffeeBox: Box = { x: 660, y: 212, width: NODE_WIDTH, height: NODE_HEIGHT }
const coffeeDecoratorBox: Box = { x: 660, y: 400, width: 170, height: NODE_HEIGHT }

/**
 * `control` stays the true midpoint so the path renders as a straight line; `mid`
 * (used only for label placement, by `DiagramEdge` and `Packet`'s reduced-motion
 * fallback) can be nudged sideways so short labels don't sit on top of the
 * layer's own title text.
 */
function straightLink(p0: Point, p1: Point, labelOffsetX = 0): EdgeGeometry {
  const control = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const mid = { x: control.x + labelOffsetX, y: control.y }
  return { start: p0, control, end: p1, d: `M ${p0.x} ${p0.y} Q ${control.x} ${control.y} ${p1.x} ${p1.y}`, mid }
}

function buildGeometry(relations: Relation[]): Record<string, EdgeGeometry> {
  const bendOf = (id: string) => relations.find((r) => r.id === id)?.bend ?? 0
  return {
    call: straightLink(boxExit(clientBox, callEntry), callEntry),
    wrapsMilk: straightLink(sugarTop, milkTop, 48),
    wrapsCoffee: straightLink(milkTop, coreTop, 48),
    sugarExtends: edgeBetween(sugarBox, coffeeDecoratorBox, bendOf('sugarExtends')),
    milkExtends: edgeBetween(milkBox, coffeeDecoratorBox, bendOf('milkExtends')),
    decoratorImpl: edgeBetween(coffeeDecoratorBox, coffeeBox, bendOf('decoratorImpl')),
    simpleImpl: edgeBetween(coreBox, coffeeBox, bendOf('simpleImpl')),
    wrappee: edgeBetween(coffeeDecoratorBox, coffeeBox, bendOf('wrappee')),
  }
}

const LEGEND_RELATIONS = ['sugarExtends', 'milkExtends', 'decoratorImpl', 'simpleImpl', 'wrappee'] as const
const LIVE_RELATIONS = ['wrapsMilk', 'wrapsCoffee', 'call'] as const

interface LayerProps {
  participant: Participant
  box: Box
  color: string
  active: boolean
  dimmed: boolean
  selected: boolean
  note?: string
  delay: number
  reduceMotion: boolean
  onSelect: (id: string) => void
}

/** One concentric, clickable rounded-rect layer of the wrapping stack. */
function Layer({ participant: p, box, color, active, dimmed, selected, note, delay, reduceMotion, onSelect }: LayerProps) {
  const w = box.width
  const h = box.height
  const select = () => onSelect(p.id)

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${p.label} — ${p.role}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none [&:focus-visible>rect.frame]:stroke-white"
      onClick={(e) => {
        e.stopPropagation()
        select()
      }}
      onKeyDown={onActivate(select)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.7, x: box.x, y: box.y }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1, x: box.x, y: box.y }}
      transition={reduceMotion ? { duration: 0.3 } : { type: 'spring', stiffness: 260, damping: 22, delay }}
    >
      {active && (
        <motion.rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={22}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={false}
          animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.7, 0, 0.7], scale: [1, 1.02, 1] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#glow)"
        />
      )}
      <rect
        className="frame transition-colors duration-300"
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={22}
        fill={active ? `${color}1f` : '#0f172a'}
        stroke={selected ? '#ffffff' : active ? color : '#334155'}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text y={-h / 2 + 22} textAnchor="middle" className="text-[13px] font-semibold select-none" fill={active || selected ? '#f8fafc' : '#e2e8f0'}>
        {p.label}
      </text>
      <text y={-h / 2 + 38} textAnchor="middle" className="fill-slate-400 text-[11px] select-none">
        {p.role}
      </text>
      {note && (
        <g transform={`translate(0 ${h / 2 - 16})`}>
          <rect x={-(note.length * 3.6 + 10)} y={-10} width={note.length * 7.2 + 20} height={20} rx={10} fill={color} />
          <text y={4} textAnchor="middle" className="fill-slate-950 text-[11px] font-semibold font-mono select-none">
            {note}
          </text>
        </g>
      )}
    </motion.g>
  )
}

export function DecoratorVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = !!useReducedMotion()
  const geometry = useMemo(() => buildGeometry(pattern.relations), [pattern.relations])
  const byId = useMemo(() => new Map(pattern.participants.map((p) => [p.id, p])), [pattern.participants])
  const relById = useMemo(() => new Map(pattern.relations.map((r) => [r.id, r])), [pattern.relations])

  const highlight = step?.highlight ?? []
  const active = new Set(highlight)
  const dimming = active.size > 0
  const notes = step?.notes ?? {}
  const packets = step?.packets ?? []

  const client = byId.get('client')
  const coffee = byId.get('coffee')
  const coffeeDecorator = byId.get('coffeeDecorator')
  const simpleCoffee = byId.get('simpleCoffee')
  const milkDecorator = byId.get('milkDecorator')
  const sugarDecorator = byId.get('sugarDecorator')

  if (!client || !coffee || !coffeeDecorator || !simpleCoffee || !milkDecorator || !sugarDecorator) return null

  // Painted outer-to-inner (sugar at the back, core on top) so the nesting reads correctly;
  // delayed inner-to-outer (core appears first) so the "build" narrative still makes sense.
  const layers: { participant: Participant; box: Box; delay: number }[] = [
    { participant: sugarDecorator, box: sugarBox, delay: 0.24 },
    { participant: milkDecorator, box: milkBox, delay: 0.12 },
    { participant: simpleCoffee, box: coreBox, delay: 0 },
  ]

  const stateFor = (id: string) => ({
    active: active.has(id),
    dimmed: dimming && !active.has(id) && selectedId !== id,
    selected: selectedId === id,
  })

  return (
    <svg
      viewBox={pattern.viewBox ?? DEFAULT_VIEWBOX}
      className="h-auto w-full select-none"
      role="group"
      aria-label={`${pattern.name} diagram`}
      onClick={() => onSelect(null)}
    >
      <defs>
        <EdgeMarkers color={color} />
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#1e293b" />
        </pattern>
      </defs>
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#grid)" />

      {/* Reference UML strip — dimmed unless explicitly selected. */}
      {LEGEND_RELATIONS.map((id) => {
        const r = relById.get(id)
        if (!r) return null
        const s = stateFor(id)
        return <DiagramEdge key={id} relation={r} geometry={geometry[id]} color={color} {...s} onSelect={onSelect} />
      })}

      <g key={`layers-${stepIndex}`}>
        {layers.map(({ participant, box, delay }) => {
          const s = stateFor(participant.id)
          return (
            <Layer
              key={participant.id}
              participant={participant}
              box={box}
              color={color}
              {...s}
              note={notes[participant.id]}
              delay={delay}
              reduceMotion={reduceMotion}
              onSelect={onSelect}
            />
          )
        })}
      </g>

      {/* The live cost() delegation path, drawn above the layers so it's always visible. */}
      {LIVE_RELATIONS.map((id) => {
        const r = relById.get(id)
        if (!r) return null
        const s = stateFor(id)
        return <DiagramEdge key={id} relation={r} geometry={geometry[id]} color={color} {...s} onSelect={onSelect} />
      })}

      <DiagramNode participant={{ ...client, x: clientBox.x, y: clientBox.y }} color={color} {...stateFor('client')} onSelect={onSelect} />
      <DiagramNode participant={{ ...coffee, x: coffeeBox.x, y: coffeeBox.y }} color={color} {...stateFor('coffee')} onSelect={onSelect} />
      <DiagramNode
        participant={{ ...coffeeDecorator, x: coffeeDecoratorBox.x, y: coffeeDecoratorBox.y }}
        color={color}
        {...stateFor('coffeeDecorator')}
        onSelect={onSelect}
      />

      <g key={`packets-${stepIndex}`}>
        {packets.map((pk, i) => {
          const g = geometry[pk.relation]
          return g ? <Packet key={`${pk.relation}-${i}`} geometry={g} color={color} label={pk.label} reverse={pk.reverse} delay={i * 0.18} /> : null
        })}
      </g>
    </svg>
  )
}
