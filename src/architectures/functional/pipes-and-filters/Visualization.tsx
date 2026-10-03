import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const ROW1_Y = 110;
const ROW2_Y = 350;
const BAND_HEIGHT = 56;

/**
 * Pipes and Filters draws a plain, data-driven diagram with a static underlay: two
 * horizontal "pipe" bands — one per row of filters — joined by a short vertical
 * connector where the pipeline drops from the top row down to the bottom row. It is
 * nothing but a visual echo of the straight-line flow the relations already encode.
 */
export function PipesAndFiltersVisualization({
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
        x={40}
        y={ROW1_Y - BAND_HEIGHT / 2}
        width={720}
        height={BAND_HEIGHT}
        rx={BAND_HEIGHT / 2}
        fill="#0f172a"
        opacity={0.5}
      />
      <rect
        x={40}
        y={ROW2_Y - BAND_HEIGHT / 2}
        width={720}
        height={BAND_HEIGHT}
        rx={BAND_HEIGHT / 2}
        fill="#0f172a"
        opacity={0.5}
      />
      <rect x={650} y={ROW1_Y} width={30} height={ROW2_Y - ROW1_Y} fill="#0f172a" opacity={0.5} />
      <text
        x={56}
        y={ROW1_Y - BAND_HEIGHT / 2 - 10}
        className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase select-none"
      >
        parse → validate
      </text>
      <text
        x={56}
        y={ROW2_Y - BAND_HEIGHT / 2 - 10}
        className="fill-slate-600 text-[11px] font-mono tracking-wider uppercase select-none"
      >
        enrich → format
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
