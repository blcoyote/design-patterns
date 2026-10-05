import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const CONTROLLER_BAND = { x: 20, y: 100, width: 220, height: 350 };
const MODEL_BAND = { x: 290, y: 100, width: 220, height: 350 };
const VIEW_BAND = { x: 560, y: 20, width: 220, height: 430 };

const BANDS = [
  { ...CONTROLLER_BAND, label: "Controller" },
  { ...MODEL_BAND, label: "Model" },
  { ...VIEW_BAND, label: "View" },
];

/**
 * MVC swaps the generic diagram's plain background for three labelled bands —
 * Controller, Model, View — so the three-way split reads before a single step
 * plays. Participants in index.ts are positioned to sit inside their band; this
 * underlay just draws the bands behind them.
 */
export function MvcVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const underlay = (
    <g pointerEvents="none">
      {BANDS.map((band) => (
        <g key={band.label}>
          <rect
            x={band.x}
            y={band.y}
            width={band.width}
            height={band.height}
            rx={24}
            fill="var(--color-diagram-node)"
            fillOpacity={0.35}
            stroke="var(--color-line-bold)"
            strokeWidth={1.5}
            strokeDasharray="8 6"
          />
          <text
            x={band.x + 20}
            y={band.y + 28}
            className="fill-fg-subtle text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
          >
            {band.label}
          </text>
        </g>
      ))}
    </g>
  );

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
  );
}
