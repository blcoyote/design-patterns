import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Two dashed regions carry the architectural point of Serverless: the functions on one side are
 * stateless and come and go as the platform decides, and the state they need lives on the other
 * side, in managed services that outlive every instance. The platform and the triggers sit outside
 * both regions because they are the runtime, not part of the application. Regions are derived from
 * the participants' positions, so they follow the boxes in the dev layout editor. A reclaimed
 * (scaled to zero) function is shown by the step's notes and highlight, not by a separate shape.
 */
export function ServerlessVisualization({
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
          label: "Functions (stateless, scale to zero)",
          members: ["createOrder", "sendReceipt", "dailyReport"],
        },
        { label: "Managed services (state lives here)", members: ["store", "queue"] },
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
