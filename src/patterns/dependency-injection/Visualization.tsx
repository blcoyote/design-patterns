import { motion, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { boxOf } from '@/lib/geometry'
import { categories } from '@/patterns/categories'
import type { Packet, Relation, VisualizationProps } from '@/types/pattern'

/**
 * Dependency Injection keeps the generic "container builds the graph bottom-up"
 * diagram for the step-driven scenario, but adds two things that make the idea
 * tangible:
 *
 *  - a "Dependency Injection / Manual wiring" toggle that swaps the relation set
 *    for one where every class calls `new` on its own dependencies — the exact
 *    "before" picture the pattern fixes, with nothing dimmed so the tight coupling
 *    is plain to see, and
 *  - a "Try it" row (only shown in DI mode, since this is the whole point) that
 *    swaps SmtpEmailSender for a FakeEmailSender, covering its box with a dashed
 *    "test double" card and replaying the injection as a packet — independent of
 *    the step player, which it tracks and resets with exactly like strategy/state.
 */

const MANUAL_RELATIONS: Relation[] = [
  {
    id: 'm-entry',
    from: 'container',
    to: 'orderController',
    type: 'creates',
    label: 'new OrderController(...)',
    description: 'The entry point directly constructs OrderController — and everything it needs — inline.',
  },
  {
    id: 'm-ctrl-svc',
    from: 'orderController',
    to: 'orderService',
    type: 'creates',
    label: 'new OrderService(...)',
    description: 'OrderController builds its own OrderService in its constructor, instead of receiving one.',
  },
  {
    id: 'm-svc-repo',
    from: 'orderService',
    to: 'orderRepository',
    type: 'creates',
    label: 'new OrderRepository(...)',
    description: 'OrderService constructs its own OrderRepository — it now knows exactly which concrete class that is.',
  },
  {
    id: 'm-svc-email',
    from: 'orderService',
    to: 'smtpEmailSender',
    type: 'creates',
    label: 'new SmtpEmailSender()',
    description: 'OrderService also constructs its own SmtpEmailSender directly. Swapping it later means editing this line.',
  },
  {
    id: 'm-repo-config',
    from: 'orderRepository',
    to: 'config',
    type: 'creates',
    label: 'new Config()',
    description: 'OrderRepository constructs its own Config, so it can never be pointed at a different one without a code change.',
  },
  {
    id: 'm-email-impl',
    from: 'smtpEmailSender',
    to: 'emailSender',
    type: 'implements',
    description: 'SmtpEmailSender still implements EmailSender — but OrderService holds a concrete SmtpEmailSender, not the interface, so that fact buys it nothing.',
  },
]

export function DependencyInjectionVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = !!useReducedMotion()

  // Each override is tagged with the step it was picked on, so both derive back
  // to "off" as soon as the step player moves — no effect/sync required.
  const [modeOverride, setModeOverride] = useState<{ forStep: number; manual: boolean } | null>(null)
  const [swapOverride, setSwapOverride] = useState<{ forStep: number; swapped: boolean } | null>(null)
  const [replayToken, setReplayToken] = useState(0)

  const isManual = modeOverride?.forStep === stepIndex ? modeOverride.manual : false
  const swapped = !isManual && swapOverride?.forStep === stepIndex ? swapOverride.swapped : false

  const byId = useMemo(() => new Map(pattern.participants.map((p) => [p.id, p])), [pattern.participants])
  const smtp = byId.get('smtpEmailSender')

  let highlight: string[] = []
  let packets: Packet[] = []
  let notes: Record<string, string> = {}

  if (isManual) {
    // Nothing is dimmed: the point is to see the whole chain of `new` calls at once.
    highlight = []
  } else if (swapped) {
    highlight = ['service-holds-email', 'smtpEmailSender', 'emailSender', 'orderService']
    packets = [{ relation: 'service-holds-email', label: 'fakeEmailSender', reverse: true }]
    notes = { orderService: 'emailSender: Fake (test)', smtpEmailSender: 'swapped → Fake' }
  } else {
    highlight = step?.highlight ?? []
    packets = step?.packets ?? []
    notes = step?.notes ?? {}
  }

  const animationKey = isManual ? 'manual' : swapped ? `swap-${replayToken}` : stepIndex

  function setMode(manual: boolean) {
    setModeOverride({ forStep: stepIndex, manual })
  }

  function setSwap(next: boolean) {
    setSwapOverride({ forStep: stepIndex, swapped: next })
    setReplayToken((t) => t + 1)
    onSelect('smtpEmailSender')
  }

  const smtpBox = smtp ? boxOf(smtp) : null

  const overlay = (
    <>
      {isManual && (
        <text x={400} y={26} textAnchor="middle" className="fill-slate-300 text-[13px] font-mono select-none" pointerEvents="none">
          Before: every class constructs its own dependencies with `new`
        </text>
      )}
      {swapped && smtpBox && (
        <motion.g
          key={`swap-badge-${replayToken}`}
          transform={`translate(${smtpBox.x} ${smtpBox.y})`}
          pointerEvents="none"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
        >
          <rect
            x={-smtpBox.width / 2}
            y={-smtpBox.height / 2}
            width={smtpBox.width}
            height={smtpBox.height}
            rx={12}
            fill="#0f172a"
            stroke={color}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <text y={-2} textAnchor="middle" className="text-[14px] font-semibold select-none" fill="#f8fafc">
            FakeEmailSender
          </text>
          <text y={16} textAnchor="middle" className="fill-slate-400 text-[11px] select-none">
            Test double
          </text>
        </motion.g>
      )}
    </>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">View</span>
        {(
          [
            { id: 'di', label: 'Dependency Injection', manual: false },
            { id: 'manual', label: 'Manual wiring (before)', manual: true },
          ] as const
        ).map((opt) => {
          const isActive = isManual === opt.manual
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={isActive}
              onClick={(e) => {
                e.stopPropagation()
                setMode(opt.manual)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
                isActive ? 'text-slate-950 ring-transparent' : 'text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
              style={isActive ? { backgroundColor: color } : undefined}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <Diagram
        participants={pattern.participants}
        relations={isManual ? MANUAL_RELATIONS : pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={highlight}
        packets={packets}
        notes={notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        overlay={overlay}
        ariaLabel={`${pattern.name} diagram`}
      />

      {isManual ? (
        <p className="border-t border-slate-800 p-3 text-xs text-slate-500">
          There is no container here to ask for a different EmailSender — swapping one in means editing OrderService's source.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
          <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">Try it</span>
          {([false, true] as const).map((isFake) => {
            const isActive = swapped === isFake
            return (
              <button
                key={String(isFake)}
                type="button"
                aria-pressed={isActive}
                aria-label={isFake ? 'Wire a FakeEmailSender instead' : 'Wire the real SmtpEmailSender'}
                onClick={(e) => {
                  e.stopPropagation()
                  setSwap(isFake)
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
                  isActive ? 'text-slate-950 ring-transparent' : 'text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
                style={isActive ? { backgroundColor: color } : undefined}
              >
                {isFake ? 'FakeEmailSender (test)' : 'SmtpEmailSender (real)'}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
