import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * The dashed regions are team ownership, and they are not all alike: the Checkout team owns a
 * fragment and the backend-for-frontend behind it, the Product and Inspire teams own only a
 * fragment that calls the shared services directly, and the Mobile team owns only a BFF. The shell, the browser,
 * the mobile app and the shared services belong to no team here, so they stay outside every region.
 * Regions are derived from the participants' positions, so they follow the boxes in the dev layout
 * editor. The v2 deploy and the failed recommendations are shown by each step's notes and
 * highlight, not by separate shapes.
 */
export function MicroFrontendsVisualization({
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
        { label: "Mobile team", members: ["mobileBff"] },
        { label: "Product team", members: ["productFragment"] },
        { label: "Checkout team", members: ["buyBox", "checkoutBff"] },
        { label: "Inspire team", members: ["recsFragment"] },
      ]}
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
