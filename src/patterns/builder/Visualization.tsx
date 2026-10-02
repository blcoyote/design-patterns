import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Diagram } from '@/components/viz/Diagram'
import { onActivate } from '@/lib/a11y'
import { boxOf } from '@/lib/geometry'
import { categories } from '@/patterns/categories'
import type { VisualizationProps } from '@/types/pattern'

interface FieldState {
  method: string | null
  url: string
  headers: string | null
  query: string | null
  body: string | null
}

/** What the blueprint shows at each step of the story. Steps 0-2 drive
 * HttpRequestBuilder; steps 3-4 drive CurlCommandBuilder with the exact same
 * recipe, to make the "different representation" payoff visible. */
const FIELDS_BY_STEP: FieldState[] = [
  { method: null, url: '/api/items', headers: null, query: null, body: null },
  { method: 'POST', url: '/api/items', headers: 'Content-Type', query: null, body: '{ name: … }' },
  { method: 'POST', url: '/api/items', headers: 'Content-Type', query: null, body: '{ name: … }' },
  { method: 'POST', url: '/api/items', headers: 'Content-Type', query: null, body: '{ name: … }' },
  { method: 'POST', url: '/api/items', headers: 'Content-Type', query: null, body: '{ name: … }' },
]

const CARD = { x: 400, y: 270, width: 180, height: 164 }
const ROW_LABELS: Array<{ key: keyof Omit<FieldState, 'url'>; label: string }> = [
  { key: 'method', label: 'method' },
  { key: 'headers', label: 'headers' },
  { key: 'query', label: 'query' },
  { key: 'body', label: 'body' },
]

/** Builder: a blueprint card between the two concrete builders fills in
 * field-by-field, then flies into whichever product (HttpRequest or the curl
 * command) the active builder is assembling once getResult() runs. */
export function BuilderVisualization({ pattern, step, stepIndex, selectedId, onSelect }: VisualizationProps) {
  const color = categories[pattern.category].color
  const reduceMotion = useReducedMotion()
  const byId = new Map(pattern.participants.map((p) => [p.id, p]))

  const usingCurl = stepIndex >= 3
  const activeProductId = usingCurl ? 'curlCommand' : 'request'
  const product = byId.get(activeProductId)
  const fields = FIELDS_BY_STEP[Math.min(stepIndex, FIELDS_BY_STEP.length - 1)]
  const filledCount = ROW_LABELS.filter((r) => fields[r.key]).length
  const isBuildStep = stepIndex === 2 || stepIndex === 4
  const blueprintLabel = usingCurl ? '«blueprint» curl command' : '«blueprint» HttpRequest'

  const select = (id: string) => (e: ReactMouseEvent | ReactKeyboardEvent) => {
    e.stopPropagation()
    onSelect(id)
  }

  const targetBox = product ? boxOf(product) : null

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
          <motion.g
            role="button"
            tabIndex={0}
            aria-label={`${usingCurl ? 'curl command' : 'HttpRequest'} blueprint — ${filledCount} of 4 optional parts set`}
            aria-pressed={selectedId === activeProductId}
            className="cursor-pointer outline-none"
            onClick={select(activeProductId)}
            onKeyDown={onActivate(() => onSelect(activeProductId))}
            initial={false}
            animate={
              isBuildStep && targetBox && !reduceMotion
                ? {
                    x: [0, 0, targetBox.x - CARD.x],
                    y: [0, 0, targetBox.y - CARD.y],
                    scale: [1, 1, 0.35],
                    opacity: [1, 1, 0],
                  }
                : { x: 0, y: 0, scale: 1, opacity: 1 }
            }
            transition={isBuildStep && !reduceMotion ? { duration: 1.6, times: [0, 0.6, 1], ease: 'easeInOut' } : { duration: 0.3 }}
          >
            <g transform={`translate(${CARD.x} ${CARD.y})`}>
              <motion.rect
                x={-CARD.width / 2}
                y={-CARD.height / 2}
                width={CARD.width}
                height={CARD.height}
                rx={12}
                fill="#0f172a"
                initial={false}
                animate={{ stroke: isBuildStep ? color : '#334155' }}
                strokeWidth={isBuildStep ? 2.5 : 1.5}
                strokeDasharray={isBuildStep ? undefined : '5 4'}
              />
              <text y={-CARD.height / 2 + 18} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono select-none">
                {blueprintLabel}
              </text>
              {isBuildStep && (
                <AnimatePresence>
                  <motion.g
                    initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <circle cx={CARD.width / 2 - 18} cy={-CARD.height / 2 + 16} r={11} fill={color} />
                    <path
                      d={`M ${CARD.width / 2 - 23} ${-CARD.height / 2 + 16} l 4 4 l 7 -8`}
                      fill="none"
                      stroke="#020617"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.g>
                </AnimatePresence>
              )}

              {/* url: always present — the one piece passed to the builder's constructor. */}
              <g transform={`translate(0 ${-CARD.height / 2 + 40})`}>
                <text x={-CARD.width / 2 + 14} textAnchor="start" className="fill-slate-500 text-[10px] font-mono select-none">
                  url
                </text>
                <text x={CARD.width / 2 - 14} textAnchor="end" className="fill-slate-200 text-[11px] font-mono select-none">
                  {fields.url}
                </text>
              </g>
              <line x1={-CARD.width / 2 + 10} x2={CARD.width / 2 - 10} y1={-CARD.height / 2 + 50} y2={-CARD.height / 2 + 50} stroke="#1e293b" />

              {ROW_LABELS.map((row, i) => {
                const value = fields[row.key]
                const y = -CARD.height / 2 + 68 + i * 24
                return (
                  <g key={`${row.key}-${stepIndex}`} transform={`translate(0 ${y})`}>
                    <text x={-CARD.width / 2 + 14} textAnchor="start" className="fill-slate-500 text-[10px] font-mono select-none">
                      {row.label}
                    </text>
                    <AnimatePresence mode="wait">
                      {value ? (
                        <motion.text
                          key="value"
                          x={CARD.width / 2 - 14}
                          textAnchor="end"
                          className="text-[11px] font-mono font-semibold select-none"
                          fill={color}
                          initial={reduceMotion ? { opacity: 1, x: CARD.width / 2 - 14 } : { opacity: 0, x: CARD.width / 2 - 4 }}
                          animate={{ opacity: 1, x: CARD.width / 2 - 14 }}
                          transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.1 + i * 0.1 }}
                        >
                          {value}
                        </motion.text>
                      ) : (
                        <motion.rect
                          key="placeholder"
                          x={CARD.width / 2 - 54}
                          y={-9}
                          width={40}
                          height={14}
                          rx={4}
                          fill="none"
                          stroke="#334155"
                          strokeDasharray="3 3"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </AnimatePresence>
                  </g>
                )
              })}

              <text y={CARD.height / 2 - 12} textAnchor="middle" className="fill-slate-500 text-[10px] font-mono select-none">
                parts: {filledCount}/4
              </text>
            </g>
          </motion.g>
        </g>
      }
    />
  )
}
