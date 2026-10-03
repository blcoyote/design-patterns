import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { boxOf } from '@/lib/geometry'
import type { Step, VisualizationProps } from '@/types/pattern'

/**
 * Chain of Responsibility stays the Handler/chain diagram, but the "a request hops
 * handler → handler until one of them deals with it" idea is made tangible with a
 * "Try it" row: four preset requests that each settle (or get rejected) at a
 * different link, plus a status badge that pops up over the Client once the
 * outcome reaches it — exactly as it would for a real caller.
 */

type ScenarioId = 'valid' | 'badAuth' | 'rateLimited' | 'badPayload'

const SCENARIO_IDS: ScenarioId[] = ['valid', 'badAuth', 'rateLimited', 'badPayload']

const LABELS: Record<ScenarioId, string> = {
  valid: 'Valid request',
  badAuth: 'Expired token',
  rateLimited: 'Too many requests',
  badPayload: 'Bad payload',
}

/** Which participant the request ultimately stops at for each scenario. */
const STOPS_AT: Record<ScenarioId, string> = {
  valid: 'controller',
  badAuth: 'authHandler',
  rateLimited: 'rateLimitHandler',
  badPayload: 'validationHandler',
}

const STATUS: Record<ScenarioId, { code: number; text: string; ok: boolean }> = {
  valid: { code: 200, text: 'OK', ok: true },
  badAuth: { code: 401, text: 'Unauthorized', ok: false },
  rateLimited: { code: 429, text: 'Too Many Requests', ok: false },
  badPayload: { code: 422, text: 'Invalid payload', ok: false },
}

const SKIPPED = 'skipped'

/** Builds the full diagram step for a preset request, independent of the step player. */
function scenarioStep(id: ScenarioId): Step {
  const status = STATUS[id]
  const base = {
    title: `Try: ${LABELS[id]}`,
    description: `The request travels the chain until it reaches ${STOPS_AT[id]}, which ${status.ok ? 'handles it' : 'rejects it'}.`,
  }

  switch (id) {
    case 'valid':
      return {
        ...base,
        highlight: ['entry', 'authHandler', 'nextAuthRate', 'rateLimitHandler', 'nextRateValid', 'validationHandler', 'nextValidController', 'controller'],
        packets: [
          { relation: 'entry', label: 'handle(req)' },
          { relation: 'nextAuthRate', label: 'next.handle()' },
          { relation: 'nextRateValid', label: 'next.handle()' },
          { relation: 'nextValidController', label: 'next.handle()' },
        ],
        notes: { authHandler: 'ok ✓', rateLimitHandler: 'ok ✓', validationHandler: 'ok ✓', controller: '200 OK' },
      }
    case 'badAuth':
      return {
        ...base,
        highlight: ['entry', 'authHandler'],
        packets: [
          { relation: 'entry', label: 'handle(req)' },
          { relation: 'entry', label: '401', reverse: true },
        ],
        notes: { authHandler: 'expired ✗', rateLimitHandler: SKIPPED, validationHandler: SKIPPED, controller: SKIPPED },
      }
    case 'rateLimited':
      return {
        ...base,
        highlight: ['entry', 'authHandler', 'nextAuthRate', 'rateLimitHandler'],
        packets: [
          { relation: 'entry', label: 'handle(req)' },
          { relation: 'nextAuthRate', label: 'next.handle()' },
          { relation: 'nextAuthRate', label: '429', reverse: true },
          { relation: 'entry', label: '429', reverse: true },
        ],
        notes: { authHandler: 'ok ✓', rateLimitHandler: 'limit hit ✗', validationHandler: SKIPPED, controller: SKIPPED },
      }
    case 'badPayload':
      return {
        ...base,
        highlight: ['entry', 'authHandler', 'nextAuthRate', 'rateLimitHandler', 'nextRateValid', 'validationHandler'],
        packets: [
          { relation: 'entry', label: 'handle(req)' },
          { relation: 'nextAuthRate', label: 'next.handle()' },
          { relation: 'nextRateValid', label: 'next.handle()' },
          { relation: 'nextRateValid', label: '422', reverse: true },
          { relation: 'nextAuthRate', label: '422', reverse: true },
          { relation: 'entry', label: '422', reverse: true },
        ],
        notes: { authHandler: 'ok ✓', rateLimitHandler: 'ok ✓', validationHandler: 'bad schema ✗', controller: SKIPPED },
      }
  }
}

/** Best-guess scenario for a narrative step, so the "Try it" row stays in sync while the player runs. */
function scenarioFromStep(step: Step | null): ScenarioId {
  if (step?.notes?.authHandler?.includes('expired')) return 'badAuth'
  return 'valid'
}

export function ChainOfResponsibilityVisualization({ pattern, color, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const reduceMotion = !!useReducedMotion()
  // Tag the override with the step it was picked on, so it falls back to "no
  // override" (the real narrative step) as soon as the step player moves on.
  const [pickedOverride, setPickedOverride] = useState<{ forStep: number; id: ScenarioId } | null>(null)
  const [replayToken, setReplayToken] = useState(0)
  const override = pickedOverride?.forStep === stepIndex ? pickedOverride.id : null

  const byId = useMemo(() => new Map(pattern.participants.map((p) => [p.id, p])), [pattern.participants])

  const effectiveStep = override ? scenarioStep(override) : step
  const activeScenario = override ?? scenarioFromStep(step)
  const animationKey = override ? `override-${override}-${replayToken}` : stepIndex

  const client = byId.get('client')
  const status = override ? STATUS[override] : undefined

  function pick(id: ScenarioId) {
    setPickedOverride({ forStep: stepIndex, id })
    setReplayToken((t) => t + 1)
    onSelect(STOPS_AT[id])
  }

  const overlay = client && status && (
    <g transform={`translate(${boxOf(client).x} ${boxOf(client).y})`} pointerEvents="none">
      <AnimatePresence>
        <motion.g
          key={`${override}-${status.code}-${replayToken}`}
          initial={reduceMotion ? false : { opacity: 0, y: 52, scale: 0.6 }}
          animate={{ opacity: 1, y: 62, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 22 }}
        >
          <rect
            x={-54}
            y={-14}
            width={108}
            height={28}
            rx={14}
            fill={status.ok ? color : '#f87171'}
          />
          <text y={5} textAnchor="middle" className="fill-slate-950 text-[12px] font-bold font-mono select-none">
            {status.code} {status.text}
          </text>
        </motion.g>
      </AnimatePresence>
    </g>
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
        overlay={overlay}
        ariaLabel={`${pattern.name} diagram`}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">Try it</span>
        {SCENARIO_IDS.map((id) => {
          const isActive = activeScenario === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={isActive}
              aria-label={`Send a request that ${STATUS[id].ok ? 'succeeds' : 'is rejected'} (${LABELS[id]})`}
              onClick={(e) => {
                e.stopPropagation()
                pick(id)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
                isActive ? 'text-slate-950 ring-transparent' : 'text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: STATUS[id].ok ? color : '#f87171' } : undefined}
            >
              {LABELS[id]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
