import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";

const ORDERS_BOX = { x: 30, y: 180, width: 480, height: 330, label: "Orders service" };
const INVENTORY_BOX = { x: 560, y: 180, width: 230, height: 330, label: "Inventory service" };
const PAYMENTS_BOX = { x: 830, y: 180, width: 230, height: 330, label: "Payments service" };

/**
 * Microservices swaps the generic diagram's plain background for three dashed service
 * boundaries — Orders, Inventory, Payments — each with its own small "DB" box, so the
 * central idea (independently owned data, crossed only through an explicit client or
 * message interface) reads before a single step plays. Orders keeps its own store of
 * the orders it has recorded, just like Inventory and Payments keep their own catalog
 * and ledger. The broker and its subscriber sit outside any boundary, since neither
 * owns the kind of private store the three services do.
 */
function ServiceBox({
  x,
  y,
  width,
  height,
  label,
  showDb,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  showDb: boolean;
}) {
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={24}
        fill="var(--color-diagram-node)"
        fillOpacity={0.35}
        stroke="var(--color-line-bold)"
        strokeWidth={1.5}
        strokeDasharray="8 6"
      />
      <text
        x={x + 18}
        y={y + 28}
        className="fill-fg-subtle text-[12px] font-mono font-semibold tracking-wider uppercase select-none"
      >
        {label}
      </text>
      {showDb && (
        <>
          <rect
            x={x + width / 2 - 36}
            y={y + height - 64}
            width={72}
            height={34}
            rx={6}
            fill="var(--color-surface-raised)"
            stroke="var(--color-line-bold)"
            strokeWidth={1}
          />
          <text
            x={x + width / 2}
            y={y + height - 43}
            textAnchor="middle"
            className="fill-fg-muted text-[11px] font-mono select-none"
          >
            DB
          </text>
        </>
      )}
    </g>
  );
}

export function MicroservicesVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const underlay = (
    <g>
      <ServiceBox {...ORDERS_BOX} showDb={true} />
      <ServiceBox {...INVENTORY_BOX} showDb={true} />
      <ServiceBox {...PAYMENTS_BOX} showDb={true} />
    </g>
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
