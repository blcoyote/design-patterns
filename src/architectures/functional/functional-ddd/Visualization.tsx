import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Functional DDD draws the same two dashed bounded-context regions as the OO page, plus
 * a lighter dashed "Pure core" region inside Ordering: everything in it is data and pure
 * functions, everything outside it in the Ordering region (the handler and the store) is
 * the imperative shell that does I/O. The ACL participant is positioned in index.ts to
 * straddle the seam; the regions and the seam are derived from the participants'
 * positions, so they follow the boxes.
 */
export function FunctionalDddVisualization({
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
          members: [
            "handler",
            "orderStore",
            "workflow",
            "money",
            "orderLine",
            "order",
            "orderPlaced",
          ],
        },
        {
          label: "Pure core",
          members: ["workflow", "money", "orderLine", "order", "orderPlaced"],
          inner: true,
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
