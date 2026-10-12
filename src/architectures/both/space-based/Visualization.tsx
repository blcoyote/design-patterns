import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Two dashed regions carry the architectural point of Space-Based: the processing units, which hold
 * the working data in memory and answer every request, and the data tier, which is the slow side that
 * requests never wait on. The messaging grid, the data grid, the deployment manager and the pump are
 * the virtualized middleware between them and stay outside both regions. Regions are derived from the
 * participants' positions, so they follow the boxes in the dev layout editor. A unit that has not
 * been started yet (pu-3 before the spike) is shown by the step's notes and highlight, not by a
 * separate shape.
 */
export function SpaceBasedVisualization({
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
        { label: "Processing units (in-memory replicas)", members: ["pu1", "pu2", "pu3"] },
        { label: "Data tier (durable)", members: ["dataWriter", "dataReader", "database"] },
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
