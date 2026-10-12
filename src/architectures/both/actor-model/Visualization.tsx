import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * The Actor Model draws one dashed region per actor, wrapping the actor and its mailbox: that
 * boundary is the isolation, because nothing outside a region touches the state inside it. Every
 * arrow that crosses a boundary is a message put in a mailbox, except restart, which is the
 * supervisor's direct ctx.restart call into the ActorSystem. The supervisor's region sits above the
 * account's so that supervision reads as a tree. Regions are derived from the participants'
 * positions, so they follow the boxes in the dev layout editor. A crashed (suspended) account
 * is shown by the step's notes and highlight, not by a separate shape.
 */
export function ActorModelVisualization({
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
        { label: "supervisor", members: ["supervisorMailbox", "supervisor"] },
        { label: "account", members: ["accountMailbox", "account"] },
        { label: "teller", members: ["tellerMailbox", "teller"] },
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
