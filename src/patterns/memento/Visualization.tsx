import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { onActivate } from '@/lib/a11y'
import { categories } from '@/patterns/categories'
import type { Packet, VisualizationProps } from '@/types/pattern'

/**
 * Memento keeps the generic Originator/Memento/Caretaker diagram on top, and adds a
 * literal "desk" below it: a text editor on the left and a history shelf of snapshot
 * cards on the right. Saving flies a card from the editor onto the shelf; undo pops the
 * top card and flies it back into the editor, overwriting the content. The shelf never
 * reads a card's label to decide anything — it only ever pushes and pops them.
 */

interface LiveState {
  content: string
  shelf: { id: number; text: string }[]
}

type Action = 'type' | 'save' | 'undo'

/** Editor content and shelf contents at the end of each narrative step. */
const STEP_CONTENT = ['', 'Hello', 'Hello', 'Hello', 'Hello, world!', 'Hello, world!', 'Hello', 'Hello']
const STEP_SHELF: string[][] = [[], [], [], ['Hello'], ['Hello'], [], [], []]

const TYPED_WORDS = [' World', '!', ' — Memento', ' pattern', ' rocks', ' undo']

function truncate(text: string, max = 16): string {
  const quoted = text.length <= max ? text : `${text.slice(0, max)}…`
  return `"${quoted}"`
}

/** Synthesizes the top diagram's highlight/packets/notes for a Try-it action. */
function synthStep(action: Action, after: LiveState) {
  switch (action) {
    case 'type':
      return {
        highlight: ['client', 'client-type', 'editor'],
        packets: [{ relation: 'client-type', label: 'type(…)' }] as Packet[],
        notes: { editor: `content: ${truncate(after.content)}` } as Record<string, string>,
      }
    case 'save':
      return {
        highlight: ['client', 'client-save', 'editor', 'editor-create', 'client-push', 'history', 'history-holds', 'memento'],
        packets: [
          { relation: 'client-save', label: 'save()' },
          { relation: 'editor-create', label: '⇒ Memento' },
          { relation: 'client-push', label: 'push(memento)' },
        ] as Packet[],
        notes: { memento: truncate(after.content), history: `shelf: ${after.shelf.length}` } as Record<string, string>,
      }
    case 'undo':
      return {
        highlight: ['client', 'client-pop', 'history', 'history-holds', 'memento', 'client-restore', 'editor', 'editor-read'],
        packets: [
          { relation: 'client-pop', label: '⇒ memento', reverse: true },
          { relation: 'client-restore', label: 'restore(memento)' },
          { relation: 'editor-read', label: 'mementoState.get()' },
        ] as Packet[],
        notes: { history: `shelf: ${after.shelf.length}`, editor: `content: ${truncate(after.content)}` } as Record<string, string>,
      }
  }
}

export function MementoVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = !!useReducedMotion()

  // Tag the override with the step it was fired on, so it falls back to the narrated
  // step as soon as the step player moves on — same pattern as state/chain-of-responsibility.
  const [liveOverride, setLiveOverride] = useState<{ forStep: number; action: Action; state: LiveState } | null>(null)
  const [replayToken, setReplayToken] = useState(0)
  const nextCardId = useRef(1)
  const typedWordIndex = useRef(0)

  const idx = Math.min(stepIndex, STEP_CONTENT.length - 1)
  const narrativeContent = STEP_CONTENT[idx]
  const narrativeShelf: LiveState['shelf'] = STEP_SHELF[idx].map((text, i) => ({ id: i, text }))

  const override = liveOverride?.forStep === stepIndex ? liveOverride : null
  const live: LiveState = override ? override.state : { content: narrativeContent, shelf: narrativeShelf }

  const synthesized = override ? synthStep(override.action, override.state) : null
  const effectiveHighlight = synthesized?.highlight ?? step?.highlight
  const effectivePackets = synthesized?.packets ?? step?.packets
  const effectiveNotes = synthesized?.notes ?? step?.notes
  const animationKey = override ? `override-${override.action}-${replayToken}` : stepIndex

  function currentLive(): LiveState {
    return override ? override.state : { content: narrativeContent, shelf: narrativeShelf }
  }

  function fire(action: Action, next: LiveState) {
    setLiveOverride({ forStep: stepIndex, action, state: next })
    setReplayToken((t) => t + 1)
  }

  function doType() {
    const current = currentLive()
    const word = TYPED_WORDS[typedWordIndex.current % TYPED_WORDS.length]
    typedWordIndex.current += 1
    fire('type', { content: current.content + word, shelf: current.shelf })
    onSelect('editor')
  }

  function doSave() {
    const current = currentLive()
    const id = nextCardId.current++
    fire('save', { content: current.content, shelf: [...current.shelf, { id, text: current.content }] })
    onSelect('memento')
  }

  function doUndo() {
    const current = currentLive()
    if (current.shelf.length === 0) return
    const popped = current.shelf[current.shelf.length - 1]
    fire('undo', { content: popped.text, shelf: current.shelf.slice(0, -1) })
    onSelect('editor')
  }

  const editorActive = !!effectiveHighlight?.includes('editor')
  const shelfActive = !!effectiveHighlight?.includes('history') || !!effectiveHighlight?.includes('memento')

  // Panel-local coordinates: editor on the left, shelf ledge on the right.
  const EDITOR_CENTER = { x: 150, y: 95 }
  const SHELF_X = 560
  const SHELF_BASE_Y = 150
  // Squeeze the stack together as it grows so every snapshot stays inside the viewBox.
  const CARD_GAP = Math.min(38, (SHELF_BASE_Y - 56) / Math.max(1, live.shelf.length - 1))

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={effectiveHighlight}
        packets={effectivePackets}
        notes={effectiveNotes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        ariaLabel={`${pattern.name} diagram`}
      />

      <div className="border-t border-slate-800 p-3">
        <svg
          viewBox="0 0 760 190"
          className="h-auto w-full select-none rounded-lg bg-slate-950/40 ring-1 ring-slate-800"
          role="group"
          aria-label={`Editor content ${truncate(live.content)}, history shelf holding ${live.shelf.length} snapshot${live.shelf.length === 1 ? '' : 's'}`}
        >
          {/* Editor mockup */}
          <g
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label="TextEditor — click to select"
            onClick={(e) => {
              e.stopPropagation()
              onSelect('editor')
            }}
            onKeyDown={onActivate(() => onSelect('editor'))}
          >
            <rect
              x={20}
              y={25}
              width={260}
              height={140}
              rx={14}
              fill="#0f172a"
              stroke={editorActive || selectedId === 'editor' ? color : '#334155'}
              strokeWidth={editorActive || selectedId === 'editor' ? 2.5 : 1.5}
            />
            <text x={36} y={46} className="fill-slate-500 text-[10px] font-mono uppercase tracking-wider select-none">
              TextEditor
            </text>
            <foreignObject x={32} y={56} width={236} height={96}>
              <div className="break-words font-mono text-[13px] leading-snug text-slate-100">
                {live.content || <span className="text-slate-600">(empty)</span>}
                <motion.span
                  aria-hidden
                  className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] bg-slate-100 align-middle"
                  animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
                />
              </div>
            </foreignObject>
          </g>

          {/* History shelf ledge */}
          <text x={420} y={38} className="fill-slate-500 text-[10px] font-mono uppercase tracking-wider select-none">
            HistoryShelf (opaque)
          </text>
          <rect
            x={420}
            y={162}
            width={300}
            height={6}
            rx={3}
            fill={shelfActive || selectedId === 'history' ? color : '#334155'}
          />

          <AnimatePresence>
            {live.shelf.map((card, i) => {
              const target = { x: SHELF_X, y: SHELF_BASE_Y - i * CARD_GAP }
              const isTop = i === live.shelf.length - 1
              return (
                <motion.g
                  key={card.id}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Memento #${i + 1} on the shelf — contents are private`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect('memento')
                  }}
                  onKeyDown={onActivate(() => onSelect('memento'))}
                  initial={reduceMotion ? { opacity: 0 } : { x: EDITOR_CENTER.x, y: EDITOR_CENTER.y, opacity: 0, scale: 0.6 }}
                  animate={{ x: target.x, y: target.y, opacity: 1, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { x: EDITOR_CENTER.x, y: EDITOR_CENTER.y, opacity: 0, scale: 0.6 }}
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
                >
                  <rect
                    x={-105}
                    y={-16}
                    width={210}
                    height={32}
                    rx={8}
                    fill={isTop ? `${color}22` : '#0f172a'}
                    stroke={isTop && (shelfActive || selectedId === 'memento') ? color : '#475569'}
                    strokeWidth={isTop ? 2 : 1.5}
                  />
                  <text y={5} textAnchor="middle" className="fill-slate-400 text-[11px] font-mono select-none">
                    Memento #{i + 1} — sealed
                  </text>
                </motion.g>
              )
            })}
          </AnimatePresence>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">Try it</span>
        <button
          type="button"
          aria-label="Type more text into the editor"
          onClick={(e) => {
            e.stopPropagation()
            doType()
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
        >
          type()
        </button>
        <button
          type="button"
          aria-label="Save a checkpoint onto the history shelf"
          onClick={(e) => {
            e.stopPropagation()
            doSave()
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white"
          style={{ color: '#0f172a', backgroundColor: color, borderColor: color }}
        >
          save()
        </button>
        <button
          type="button"
          aria-label="Undo — pop the last checkpoint and restore the editor"
          disabled={live.shelf.length === 0}
          onClick={(e) => {
            e.stopPropagation()
            doUndo()
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
            live.shelf.length === 0
              ? 'cursor-not-allowed text-slate-600 ring-slate-800 ring-dashed'
              : 'text-slate-100 ring-slate-700 hover:bg-slate-800'
          }`}
        >
          undo()
        </button>
      </div>
    </div>
  )
}
