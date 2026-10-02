import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { onActivate } from '@/lib/a11y'
import { categories } from '@/patterns/categories'
import type { VisualizationProps } from '@/types/pattern'

/**
 * Iterator keeps the class diagram (Iterable/Iterator interfaces, Playlist,
 * PlaylistIterator) up top, and adds a strip of "song" cells below it: a
 * cursor springs from cell to cell as next() is called, a small token
 * carries the yielded value over to the Client, and a "done" flag lights up
 * once the cursor runs past the last cell.
 */

const SONGS = ['Intro', 'Verse', 'Chorus', 'Outro']

const CELL_W = 92
const CELL_H = 56
const CELL_GAP = 14
const STRIP_Y = 390
const STRIP_START_X = 270
const DONE_X = STRIP_START_X + SONGS.length * (CELL_W + CELL_GAP) + 30

function cellX(index: number) {
  return STRIP_START_X + index * (CELL_W + CELL_GAP) + CELL_W / 2
}

/** Number of songs already consumed (cursor position) at a given step. */
const CURSOR_BY_STEP = [0, 1, 2, 3, 4, 4, 4]
/** The value handed to the client at this step, if any. */
const YIELD_BY_STEP: Array<string | null> = [null, 'Intro', 'Verse', 'Chorus', 'Outro', null, null]
const DONE_BY_STEP = [false, false, false, false, false, true, true]

export function IteratorVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = !!useReducedMotion()
  const byId = new Map(pattern.participants.map((p) => [p.id, p]))
  const client = byId.get('client')

  const clamped = Math.min(stepIndex, CURSOR_BY_STEP.length - 1)
  const consumed = CURSOR_BY_STEP[clamped]
  const yieldedValue = YIELD_BY_STEP[clamped]
  const done = DONE_BY_STEP[clamped]
  const cursorX = consumed < SONGS.length ? cellX(consumed) : DONE_X
  const clientX = client ? client.x : 110
  const clientY = client ? client.y : 250

  const springTransition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 24 }

  const select = (id: string) => (e: ReactMouseEvent | ReactKeyboardEvent) => {
    e.stopPropagation()
    onSelect(id)
  }

  const overlay = (
    <g>
      <text x={STRIP_START_X - 10} y={STRIP_Y - CELL_H / 2 - 22} textAnchor="start" className="fill-slate-500 text-[10px] font-mono uppercase tracking-wider select-none">
        playlist.songs
      </text>

      {/* The collection, rendered as a strip of cells. */}
      <g
        role="button"
        tabIndex={0}
        aria-label="Playlist songs"
        aria-pressed={selectedId === 'playlist'}
        className="cursor-pointer outline-none"
        onClick={select('playlist')}
        onKeyDown={onActivate(() => onSelect('playlist'))}
      >
        {SONGS.map((song, i) => {
          const isConsumed = i < consumed
          const isCurrent = i === consumed && !done
          return (
            <g key={song} transform={`translate(${cellX(i)} ${STRIP_Y})`}>
              <motion.rect
                x={-CELL_W / 2}
                y={-CELL_H / 2}
                width={CELL_W}
                height={CELL_H}
                rx={10}
                fill={isCurrent ? `${color}22` : '#0f172a'}
                initial={false}
                animate={{
                  stroke: isCurrent ? color : isConsumed ? '#334155' : '#475569',
                  opacity: isConsumed ? 0.5 : 1,
                }}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              <text y={-6} textAnchor="middle" className="fill-slate-100 text-[11px] font-semibold select-none">
                {song}
              </text>
              <text y={12} textAnchor="middle" className="fill-slate-500 text-[9px] font-mono select-none">
                [{i}]
              </text>
            </g>
          )
        })}

        {/* "Done" slot, past the last cell. */}
        <g transform={`translate(${DONE_X} ${STRIP_Y})`}>
          <motion.rect
            x={-30}
            y={-CELL_H / 2}
            width={60}
            height={CELL_H}
            rx={10}
            fill="none"
            strokeDasharray="4 4"
            initial={false}
            animate={{ stroke: done ? color : '#334155', opacity: done ? 1 : 0.6 }}
          />
          <text y={4} textAnchor="middle" className="fill-slate-400 text-[9px] font-mono select-none">
            done
          </text>
        </g>
      </g>

      {/* Cursor: springs from cell to cell, then to the done slot. */}
      <motion.g
        initial={false}
        animate={{ x: cursorX, y: STRIP_Y - CELL_H / 2 - 16 }}
        transition={springTransition}
        pointerEvents="none"
      >
        <path d="M 0 0 L -7 -10 L 7 -10 Z" fill={color} />
      </motion.g>

      {/* Yielded value, flying from the strip over to the Client. */}
      <AnimatePresence>
        {yieldedValue && (
          <motion.g
            key={`${stepIndex}-${yieldedValue}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: cursorX, y: STRIP_Y + 30 }}
            animate={{ opacity: [0, 1, 1, 0], x: [cursorX, cursorX, clientX, clientX], y: [STRIP_Y + 30, STRIP_Y + 30, clientY + 50, clientY + 50] }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0.4 } : { duration: 1.4, times: [0, 0.15, 0.75, 1], ease: 'easeInOut' }}
            pointerEvents="none"
          >
            <rect x={-38} y={-13} width={76} height={26} rx={13} fill={color} />
            <text y={4} textAnchor="middle" className="fill-slate-950 text-[11px] font-bold font-mono select-none">
              "{yieldedValue}"
            </text>
          </motion.g>
        )}
      </AnimatePresence>

      {/* Done badge, settling near the client once the traversal finishes. */}
      <AnimatePresence>
        {done && (
          <motion.g
            key="done-badge"
            transform={`translate(${clientX} ${clientY + 50})`}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            pointerEvents="none"
          >
            <rect x={-46} y={-13} width={92} height={26} rx={13} fill="none" stroke={color} strokeWidth={1.5} />
            <text y={4} textAnchor="middle" className="text-[11px] font-bold font-mono select-none" fill={color}>
              done: true
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </g>
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
      overlay={overlay}
      ariaLabel={`${pattern.name} diagram`}
    />
  )
}
