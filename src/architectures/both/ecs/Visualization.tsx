import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Two dashed regions carry the architectural point of ECS: the systems, which hold all the
 * behaviour and no data, and the component stores, which hold all the data and no behaviour.
 * The game loop and the world sit outside both: the loop only runs the systems in order, and the
 * world hands out ids and answers queries. Regions are derived from the participants' positions,
 * so they follow the boxes in the dev layout editor. Entities have no box of their own, because
 * an entity is only an id: it shows up as the rows of the stores that have its id, and in the
 * packets' labels.
 */
export function EcsVisualization({
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
        { label: "Systems (behaviour)", members: ["movement", "damage", "death"] },
        {
          label: "Component stores (data)",
          members: ["positions", "velocities", "healths", "hazards", "names"],
        },
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
