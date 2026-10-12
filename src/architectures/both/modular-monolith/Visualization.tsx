import { BoundedContextUnderlay } from "@/components/viz/BoundedContextUnderlay";
import { Diagram } from "@/components/viz/Diagram";
import { boxOf } from "@/lib/geometry";
import type { Participant, VisualizationProps } from "@/types/pattern";

/** Distance from the module regions to the "one deployable" outline. */
const DEPLOYABLE_PADDING = 44;
/** Same label room as the module regions, so both outlines read alike. */
const LABEL_ROOM = 14;

/**
 * The outer dashed outline for the single deployable: it wraps the host, every module and
 * the bus (everything except the client), with its extent derived from participant
 * positions like the module regions inside it.
 */
function DeployableOutline({ participants }: { participants: Participant[] }) {
  const boxes = participants.filter((p) => p.id !== "client").map(boxOf);
  const left = Math.min(...boxes.map((b) => b.x - b.width / 2)) - DEPLOYABLE_PADDING;
  const right = Math.max(...boxes.map((b) => b.x + b.width / 2)) + DEPLOYABLE_PADDING;
  const top = Math.min(...boxes.map((b) => b.y - b.height / 2)) - DEPLOYABLE_PADDING - LABEL_ROOM;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height / 2)) + DEPLOYABLE_PADDING;

  return (
    <g pointerEvents="none">
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        rx={32}
        fill="none"
        stroke="var(--color-line-bold)"
        strokeWidth={1.5}
        strokeDasharray="2 6"
      />
      <text
        x={left + 20}
        y={top + 28}
        className="fill-fg-subtle text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        One deployable · one process
      </text>
    </g>
  );
}

/**
 * Modular Monolith draws two levels of boundary: a dashed region per module (Catalog,
 * Ordering, Shipping), each holding its public API and its private data, and one outer
 * outline for the single deployable that contains them all plus the host and the bus. The
 * client sits outside it. Regions, seams and the outline are derived from the participants'
 * positions, so they follow the boxes in the dev layout editor.
 */
export function ModularMonolithVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const underlay = (
    <>
      <DeployableOutline participants={pattern.participants} />
      <BoundedContextUnderlay
        participants={pattern.participants}
        regions={[
          { label: "Catalog module", members: ["catalogApi", "catalogStore"] },
          { label: "Ordering module", members: ["orderingApi", "orderingStore"] },
          { label: "Shipping module", members: ["shippingApi", "shippingStore"] },
        ]}
        seams={[
          ["Catalog module", "Ordering module"],
          ["Ordering module", "Shipping module"],
        ]}
        color={color}
      />
    </>
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
