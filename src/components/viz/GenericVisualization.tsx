import type { VisualizationProps } from "@/types/pattern";
import { Diagram } from "./Diagram";

/** Default visualisation: renders the pattern's participants/relations/steps as a diagram. */
export function GenericVisualization({
  pattern,
  color,
  step,
  stepIndex,
  speed,
  selectedId,
  onSelect,
}: VisualizationProps) {
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
      animationKey={stepIndex}
      packetSpeed={speed}
      ariaLabel={`${pattern.name} diagram`}
    />
  );
}
