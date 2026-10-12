import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

/**
 * Microkernel draws two regions: the core system (ClaimsCore and its registry of extension
 * points) and the plug-ins around it, with the versioned contract sitting on the seam between
 * them, because it belongs to neither side: the core publishes it and the plug-ins build
 * against it. Regions and seam are derived from the participants' positions, so they follow
 * the boxes in the dev layout editor. A rejected plug-in (legacy-tx) stays inside the Plug-ins
 * region, but its step marks it with a note and gives it no activate or register packets.
 */
export function MicrokernelVisualization({
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
        { label: "Core system", members: ["core", "registry"] },
        {
          label: "Plug-ins",
          members: ["auditLog", "caRules", "nyRules", "txRules", "legacyTx"],
        },
      ]}
      seams={[["Core system", "Plug-ins"]]}
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
