import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { onActivate } from '@/lib/a11y'
import { boxOf } from '@/lib/geometry'
import { boxExit } from '@/lib/geometry'
import { categories } from '@/patterns/categories'
import type { VisualizationProps } from '@/types/pattern'

const CHIP = { x: 590, y: 185 }

/** Singleton: a live instance counter, a blocked `new AppConfig()` attempt, and a single
 * shared "instance" chip that both clients converge on once it is created. */
export function SingletonVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = useReducedMotion()
  const byId = new Map(pattern.participants.map((p) => [p.id, p]))
  const config = byId.get('config')
  const userService = byId.get('userService')
  const paymentService = byId.get('paymentService')

  const created = stepIndex >= 1
  const showAttempt = stepIndex === 0
  const showConverge = stepIndex >= 2

  const select = (id: string) => (e: ReactMouseEvent | ReactKeyboardEvent) => {
    e.stopPropagation()
    onSelect(id)
  }

  const linesToChip =
    showConverge && config && userService && paymentService
      ? [
          { from: boxExit(boxOf(userService), CHIP), id: 'user-link' },
          { from: boxExit(boxOf(paymentService), CHIP), id: 'payment-link' },
        ]
      : []

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
      ariaLabel={`${pattern.name} diagram`}
      overlay={
        <g>
          {/* Instance counter badge, pinned in the top-right corner. Only ever 0 or 1. */}
          <g transform="translate(700 36)">
            <rect x={-58} y={-16} width={116} height={32} rx={16} fill="#0f172a" stroke="#334155" strokeWidth={1.5} />
            <text y={-2} textAnchor="middle" className="fill-slate-400 text-[9px] font-mono select-none">
              instances
            </text>
            <AnimatePresence mode="wait">
              <motion.text
                key={created ? 1 : 0}
                y={12}
                textAnchor="middle"
                className="text-[13px] font-mono font-bold select-none"
                fill={created ? color : '#64748b'}
                initial={reduceMotion ? undefined : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 12 }}
                transition={{ duration: 0.35 }}
              >
                {created ? 1 : 0}
              </motion.text>
            </AnimatePresence>
          </g>

          {/* Ghost "new AppConfig()" attempt — shaken, then struck through. */}
          {showAttempt && config && (
            <g transform={`translate(${config.x} ${config.y + 135})`}>
              <motion.g
                initial={reduceMotion ? undefined : { opacity: 0 }}
                animate={
                  reduceMotion
                    ? { opacity: 1 }
                    : { opacity: 1, x: [0, -6, 6, -4, 4, 0] }
                }
                transition={reduceMotion ? { duration: 0.3 } : { duration: 0.5, delay: 0.3, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
              >
                <rect x={-78} y={-17} width={156} height={34} rx={8} fill="#1e293b" stroke="#f43f5e" strokeWidth={1.25} strokeDasharray="4 3" opacity={0.9} />
                <text y={5} textAnchor="middle" className="fill-slate-300 text-[11px] font-mono select-none">
                  new AppConfig()
                </text>
                <motion.line
                  x1={-74}
                  y1={-13}
                  x2={74}
                  y2={13}
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.85 }}
                />
              </motion.g>
            </g>
          )}

          {/* Lines from each client converging on the one shared instance chip. */}
          {linesToChip.map((l) => (
            <motion.line
              key={l.id}
              x1={l.from.x}
              y1={l.from.y}
              x2={CHIP.x}
              y2={CHIP.y}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="3 5"
              initial={reduceMotion ? { pathLength: 1, opacity: 0.8 } : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.8 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          ))}

          {/* The one shared instance, materialising on first getInstance() call. */}
          <AnimatePresence>
            {created && (
              <motion.g
                transform={`translate(${CHIP.x} ${CHIP.y})`}
                role="button"
                tabIndex={0}
                aria-label="Shared AppConfig instance #1"
                aria-pressed={selectedId === 'config'}
                className="cursor-pointer outline-none"
                onClick={select('config')}
                onKeyDown={onActivate(() => onSelect('config'))}
                initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.3 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              >
                {showConverge && (
                  <motion.circle
                    r={34}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.5}
                    initial={{ opacity: 0.6, scale: 1 }}
                    animate={reduceMotion ? { opacity: 0.4 } : { opacity: [0.6, 0, 0.6], scale: [1, 1.3, 1] }}
                    transition={{ duration: 1.6, repeat: reduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                  />
                )}
                <circle r={26} fill={`${color}22`} stroke={color} strokeWidth={2} filter="url(#glow)" />
                <text y={-3} textAnchor="middle" className="fill-slate-100 text-[11px] font-bold select-none">
                  instance
                </text>
                <text y={11} textAnchor="middle" className="text-[10px] font-mono select-none" fill={color}>
                  #1
                </text>
              </motion.g>
            )}
          </AnimatePresence>
        </g>
      }
    />
  )
}
