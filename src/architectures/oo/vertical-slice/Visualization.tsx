import { Diagram } from '@/components/viz/Diagram'
import type { VisualizationProps } from '@/types/pattern'

const PLACE_ORDER_BAND = { x: 60, y: 230, width: 280, height: 230 }
const GET_ORDER_BAND = { x: 460, y: 230, width: 280, height: 230 }
const LAYER_LINES = [245, 345]

/**
 * Vertical Slice keeps the plain, data-driven diagram but adds two vertical
 * bands — one per slice — crossing a couple of faint horizontal lines that
 * stand for the layers a layered architecture would have cut across instead.
 * The point lands before a single step plays: this architecture cuts by
 * feature (the bands), not by technical layer (the lines).
 */
export function VerticalSliceVisualization({ pattern, color, step, stepIndex, selectedId, onSelect, speed }: VisualizationProps) {
  const underlay = (
    <g pointerEvents="none">
      {LAYER_LINES.map((y) => (
        <line key={y} x1={0} y1={y} x2={800} y2={y} stroke="#1e293b" strokeWidth={1} strokeDasharray="4 8" />
      ))}

      <rect
        x={PLACE_ORDER_BAND.x}
        y={PLACE_ORDER_BAND.y}
        width={PLACE_ORDER_BAND.width}
        height={PLACE_ORDER_BAND.height}
        rx={16}
        fill="#0f172a"
        fillOpacity={0.35}
        stroke="#475569"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={PLACE_ORDER_BAND.x + 16}
        y={PLACE_ORDER_BAND.y + 24}
        className="fill-slate-500 text-[11px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        PlaceOrder slice
      </text>

      <rect
        x={GET_ORDER_BAND.x}
        y={GET_ORDER_BAND.y}
        width={GET_ORDER_BAND.width}
        height={GET_ORDER_BAND.height}
        rx={16}
        fill="#0f172a"
        fillOpacity={0.35}
        stroke="#475569"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={GET_ORDER_BAND.x + 16}
        y={GET_ORDER_BAND.y + 24}
        className="fill-slate-500 text-[11px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        GetOrder slice
      </text>
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
