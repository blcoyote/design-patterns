import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * DDD swaps the generic diagram's plain background for two dashed bounded-context
 * regions — Ordering and Shipping — so the central idea (two separate models, never
 * sharing a database, joined only at an explicit seam) reads before a single step
 * plays. The ACL participant is positioned to straddle that seam in index.ts; this
 * underlay derives the regions and seam from the participants' positions, so they
 * follow the boxes.
 */
export function DddVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const underlay = (
    <BoundedContextUnderlay
      participants={pattern.participants}
      regions={[
        {
          label: "Ordering context",
          members: ["appService", "orderRepo", "money", "order", "orderLine", "orderPlaced"],
        },
        { label: "Shipping context", members: ["shipping"] },
      ]}
      seams={[["Ordering context", "Shipping context"]]}
      color={color}
    />
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
