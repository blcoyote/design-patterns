import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const LAYERS = [
  { label: "Presentation", y: 20 },
  { label: "Application", y: 110 },
  { label: "Domain", y: 200 },
  { label: "Data access", y: 290 },
];
const LAYER_HEIGHT = 90;
const INFRA_Y = 380;
const INFRA_HEIGHT = 80;

/**
 * Layered keeps the plain, data-driven diagram but adds an underlay of horizontal bands —
 * one per layer, plus an unshaded strip for the external database below the stack — so the
 * "each layer only talks to the one below it" shape reads at a glance.
 */
export function LayeredVisualization({
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
      {LAYERS.map((layer, i) => (
        <g key={layer.label}>
          <rect
            x={0}
            y={layer.y}
            width={800}
            height={LAYER_HEIGHT}
            fill={i % 2 === 0 ? "var(--color-diagram-node)" : "transparent"}
            opacity={0.5}
          />
          <text
            x={16}
            y={layer.y + 18}
            className="fill-fg-faint text-[11px] font-mono tracking-wider uppercase select-none"
          >
            {layer.label}
          </text>
        </g>
      ))}
      <rect x={0} y={INFRA_Y} width={800} height={INFRA_HEIGHT} fill="transparent" />
      <text
        x={16}
        y={INFRA_Y + 18}
        className="fill-line-strong text-[11px] font-mono tracking-wider uppercase select-none"
      >
        External infrastructure
      </text>
      {[...LAYERS.map((l) => l.y), INFRA_Y].map((y) => (
        <line key={y} x1={0} y1={y} x2={800} y2={y} stroke="var(--color-line)" strokeWidth={1} />
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
