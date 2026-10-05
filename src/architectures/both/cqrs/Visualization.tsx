import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const WRITE_HEIGHT = 230;
const READ_Y = 230;
const READ_HEIGHT = 230;

/**
 * CQRS keeps the plain, data-driven diagram but adds an underlay band splitting the
 * canvas into a write side (top) and a read side (bottom), so the fact that commands
 * and queries travel through entirely separate models and stores reads at a glance.
 */
export function CqrsVisualization({
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
      <rect
        x={0}
        y={0}
        width={800}
        height={WRITE_HEIGHT}
        fill="var(--color-diagram-node)"
        opacity={0.5}
      />
      <rect x={0} y={READ_Y} width={800} height={READ_HEIGHT} fill="transparent" />
      <text
        x={16}
        y={24}
        className="fill-fg-faint text-[11px] font-mono tracking-wider uppercase select-none"
      >
        Write side
      </text>
      <text
        x={16}
        y={READ_Y + 24}
        className="fill-fg-faint text-[11px] font-mono tracking-wider uppercase select-none"
      >
        Read side
      </text>
      <line
        x1={0}
        y1={READ_Y}
        x2={800}
        y2={READ_Y}
        stroke="var(--color-line)"
        strokeWidth={1}
        strokeDasharray="6 4"
      />
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
