import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Two dashed regions carry the point of the pattern: the app and its sidecar are deployed together
 * (in a real system, usually in one pod on one host), while the service they call lives somewhere
 * else. The simulated cluster network sits between the regions, and the operator stays outside both.
 * Regions are derived from the participants' positions, so they follow the boxes in the dev layout
 * editor.
 */
export function SidecarVisualization({
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
        { label: "orders pod (same host)", members: ["sidecar", "app"] },
        { label: "inventory pod", members: ["inventory"] },
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
