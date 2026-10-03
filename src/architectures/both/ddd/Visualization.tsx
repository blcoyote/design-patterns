import { Diagram } from '@/components/viz/Diagram'
import type { VisualizationProps } from '@/types/pattern'

const ORDERING_BOX = { x: 40, y: 110, width: 490, height: 400 }
const SHIPPING_BOX = { x: 560, y: 110, width: 320, height: 400 }

/**
 * DDD swaps the generic diagram's plain background for two dashed bounded-context
 * regions — Ordering and Shipping — so the central idea (two separate models, never
 * sharing a database, joined only at an explicit seam) reads before a single step
 * plays. The ACL participant is positioned to straddle that seam in index.ts; this
 * underlay just draws the regions and seam behind it.
 */
export function DddVisualization({ pattern, color, step, stepIndex, selectedId, onSelect, speed }: VisualizationProps) {
  const underlay = (
    <g pointerEvents="none">
      <rect
        x={ORDERING_BOX.x}
        y={ORDERING_BOX.y}
        width={ORDERING_BOX.width}
        height={ORDERING_BOX.height}
        rx={24}
        fill="#0f172a"
        fillOpacity={0.35}
        stroke="#475569"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={ORDERING_BOX.x + 20}
        y={ORDERING_BOX.y + 28}
        className="fill-slate-500 text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        Ordering context
      </text>

      <rect
        x={SHIPPING_BOX.x}
        y={SHIPPING_BOX.y}
        width={SHIPPING_BOX.width}
        height={SHIPPING_BOX.height}
        rx={24}
        fill="#0f172a"
        fillOpacity={0.35}
        stroke="#475569"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={SHIPPING_BOX.x + 20}
        y={SHIPPING_BOX.y + 28}
        className="fill-slate-500 text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        Shipping context
      </text>

      {/* The seam between the two contexts — the only thing allowed to cross it is the ACL. */}
      <line
        x1={(ORDERING_BOX.x + ORDERING_BOX.width + SHIPPING_BOX.x) / 2}
        y1={ORDERING_BOX.y - 10}
        x2={(ORDERING_BOX.x + ORDERING_BOX.width + SHIPPING_BOX.x) / 2}
        y2={ORDERING_BOX.y + ORDERING_BOX.height + 10}
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth={1}
        strokeDasharray="2 6"
      />
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
      packetSpeed={speed}
      animationKey={stepIndex}
      underlay={underlay}
      ariaLabel={`${pattern.name} diagram`}
    />
  )
}
