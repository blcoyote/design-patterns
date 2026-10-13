import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Two dashed regions carry the point of the pattern: the gateway and the pieces it uses to check and
 * route a request sit at the edge, and the services sit behind it, reachable only through the gateway.
 * The client stays outside both. Regions are derived from the participants' positions, so they follow
 * the boxes in the dev layout editor.
 */
export function ApiGatewayVisualization({
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
          label: "Gateway (edge)",
          members: ["gateway", "authenticator", "rateLimiter", "aggregator"],
        },
        { label: "Backend services", members: ["users", "orders"] },
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
