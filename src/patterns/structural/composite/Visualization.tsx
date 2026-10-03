import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { DEFAULT_VIEWBOX } from '@/components/viz/Diagram'
import { DiagramEdge, EdgeMarkers } from '@/components/viz/DiagramEdge'
import { PacketLayer } from '@/components/viz/PacketLayer'
import { onActivate } from '@/lib/a11y'
import { boxOf, edgeBetween, NODE_HEIGHT, NODE_WIDTH } from '@/lib/geometry'
import type { EdgeGeometry } from '@/lib/geometry'
import type { Participant, VisualizationProps } from '@/types/pattern'

/**
 * Composite drawn as a literal tree: root/ branches into docs/ and readme.md,
 * and docs/ branches further into photo.jpg and logo.png. Folder nodes get a
 * small folder glyph, file nodes a small file glyph, and the whole tree
 * "unfolds" top-down on first paint (root first, then its children, then its
 * grandchildren) to read as an expanding directory tree. The step data then
 * drives `getSize()` packets rippling down the holds-edges and size totals
 * bubbling back up, exactly like every other animated scenario.
 */

/** How deep each node sits in the tree — used only to stagger the "unfold" entrance. */
const DEPTH: Record<string, number> = {
  component: 0,
  client: 0,
  root: 0,
  docs: 1,
  readme: 1,
  photo: 2,
  logo: 2,
}

/** Folder vs. file glyph per participant id (interface/client get neither). */
const ICON: Record<string, 'folder' | 'file' | undefined> = {
  root: 'folder',
  docs: 'folder',
  readme: 'file',
  photo: 'file',
  logo: 'file',
}

function FolderGlyph({ color }: { color: string }) {
  return <path d="M -10 -6 L -2 -6 L 1 -2 L 10 -2 L 10 7 L -10 7 Z" fill={color} opacity={0.9} />
}

function FileGlyph({ color }: { color: string }) {
  return (
    <>
      <path d="M -6 -8 L 2 -8 L 8 -2 L 8 8 L -6 8 Z" fill="none" stroke={color} strokeWidth={1.5} />
      <path d="M 2 -8 L 2 -2 L 8 -2" fill="none" stroke={color} strokeWidth={1.5} />
    </>
  )
}

interface TreeNodeProps {
  participant: Participant
  color: string
  active: boolean
  dimmed: boolean
  selected: boolean
  note?: string
  icon?: 'folder' | 'file'
  delay: number
  reduceMotion: boolean
  onSelect: (id: string) => void
}

/** One clickable node in the tree: a UML-ish box with an optional folder/file glyph. */
function TreeNode({ participant: p, color, active, dimmed, selected, note, icon, delay, reduceMotion, onSelect }: TreeNodeProps) {
  const w = p.width ?? NODE_WIDTH
  const h = NODE_HEIGHT
  const stereotype = p.kind === 'interface' ? '«interface»' : p.kind === 'client' ? '«client»' : undefined
  const isAbstract = p.kind === 'interface'
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
      initial={reduceMotion ? false : { opacity: 0, scale: 0.5, x: p.x, y: p.y }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1, x: p.x, y: p.y }}
      transition={reduceMotion ? { duration: 0.3 } : { type: 'spring', stiffness: 260, damping: 22, delay }}
      whileHover={{ scale: 1.04 }}
    >
      {active && (
        <motion.rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={16}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={false}
          animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.7, 0, 0.7], scale: [1, 1.05, 1] }}
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
        rx={12}
        fill={active ? `${color}22` : '#0f172a'}
        stroke={selected ? '#ffffff' : active ? color : '#334155'}
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={isAbstract ? '6 4' : undefined}
      />
      {icon && (
        <g transform={`translate(${-w / 2 + 22} ${h / 2 - 18})`}>
          {icon === 'folder' ? <FolderGlyph color={active || selected ? color : '#64748b'} /> : <FileGlyph color={active || selected ? color : '#64748b'} />}
        </g>
      )}
      {stereotype && (
        <text y={-h / 2 + 15} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono select-none">
          {stereotype}
        </text>
      )}
      <text
        y={stereotype ? 6 : -2}
        textAnchor="middle"
        className={`text-[13px] font-semibold select-none ${isAbstract ? 'italic' : ''}`}
        fill={active || selected ? '#f8fafc' : '#e2e8f0'}
      >
        {p.label}
      </text>
      <text y={stereotype ? 22 : 16} textAnchor="middle" className="fill-slate-400 text-[10px] select-none">
        {p.role}
      </text>

      <AnimatePresence>
        {note && (
          <motion.g
            key={note}
            initial={{ opacity: 0, y: h / 2 + 8, scale: 0.6 }}
            animate={{ opacity: 1, y: h / 2 + 18, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            <rect x={-(note.length * 3.6 + 12)} y={-10} width={note.length * 7.2 + 24} height={20} rx={10} fill={color} />
            <text y={4} textAnchor="middle" className="fill-slate-950 text-[11px] font-semibold font-mono select-none">
              {note}
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  )
}

export function CompositeVisualization({ pattern, color, step, stepIndex, selectedId, onSelect, speed }: VisualizationProps) {
  const reduceMotion = !!useReducedMotion()

  const byId = useMemo(() => new Map(pattern.participants.map((p) => [p.id, p])), [pattern.participants])

  const geometry = useMemo(() => {
    const g: Record<string, EdgeGeometry> = {}
    for (const r of pattern.relations) {
      const a = byId.get(r.from)
      const b = byId.get(r.to)
      if (a && b) g[r.id] = edgeBetween(boxOf(a), boxOf(b), r.bend)
    }
    return g
  }, [pattern.relations, byId])

  const highlight = step?.highlight ?? []
  const active = new Set(highlight)
  const dimming = active.size > 0
  const notes = step?.notes ?? {}
  const packets = step?.packets ?? []

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

      {pattern.relations.map((r) => {
        const g = geometry[r.id]
        if (!g) return null
        return <DiagramEdge key={r.id} relation={r} geometry={g} color={color} {...stateFor(r.id)} onSelect={onSelect} />
      })}

      {pattern.participants.map((p) => (
        <TreeNode
          key={p.id}
          participant={p}
          color={color}
          {...stateFor(p.id)}
          note={notes[p.id]}
          icon={ICON[p.id]}
          delay={reduceMotion ? 0 : (DEPTH[p.id] ?? 0) * 0.16}
          reduceMotion={reduceMotion}
          onSelect={onSelect}
        />
      ))}

      <PacketLayer packets={packets} geometry={geometry} color={color} speed={speed} animationKey={stepIndex} />
    </svg>
  )
}
