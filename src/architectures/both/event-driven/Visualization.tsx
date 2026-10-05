import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const BROKER_BAND = { x: 330, y: 20, width: 220, height: 520 };

/**
 * Event-Driven swaps the generic diagram's plain background for a vertical broker band
 * down the middle, with the producer on the left and consumers stacked on the right —
 * so the central idea (everyone only ever talks to the broker, never to each other)
 * reads before a single step plays. The band is purely decorative; EventBroker is
 * still a normal participant positioned inside it.
 */
export function EventDrivenVisualization({
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
        x={BROKER_BAND.x}
        y={BROKER_BAND.y}
        width={BROKER_BAND.width}
        height={BROKER_BAND.height}
        rx={24}
        fill="var(--color-diagram-node)"
        fillOpacity={0.35}
        stroke="var(--color-line-bold)"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={BROKER_BAND.x + BROKER_BAND.width / 2}
        y={BROKER_BAND.y + 28}
        textAnchor="middle"
        className="fill-fg-subtle text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        Broker — topics
      </text>

      {/* Producers never see past the band on their side... */}
      <text
        x={BROKER_BAND.x - 20}
        y={BROKER_BAND.y + 28}
        textAnchor="end"
        className="fill-fg-faint text-[11px] font-mono tracking-wider uppercase select-none"
      >
        producer
      </text>

      {/* ...and consumers never see past it on theirs. */}
      <text
        x={BROKER_BAND.x + BROKER_BAND.width + 20}
        y={BROKER_BAND.y + 28}
        className="fill-fg-faint text-[11px] font-mono tracking-wider uppercase select-none"
      >
        consumers
      </text>
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
