import { useRef, useState, type PointerEvent } from "react";
import { NODE_HEIGHT, boxOf, type EdgeGeometry } from "@/lib/geometry";
import { clampToViewBox, snap } from "@/lib/layoutEdit";
import type { Participant } from "@/types/pattern";
import type { DiagramEditContextValue } from "./DiagramEditContext";

export interface EditHandlesProps {
  edit: DiagramEditContextValue;
  participants: Participant[];
  /**
   * Edge geometry by relation id, as computed by `<Diagram>`. Not read yet: it is
   * here for the relation bend handles, which sit on each curve's midpoint.
   */
  geometry: Map<string, EdgeGeometry>;
  viewBox: string;
}

interface Drag {
  id: string;
  pointerId: number;
  /** Pointer position minus the box centre at pointer-down, in viewBox units. */
  dx: number;
  dy: number;
}

/** Editor layer drawn last inside a `<Diagram>`'s svg: one drag handle per participant. */
export function EditHandles({ edit, participants, viewBox }: EditHandlesProps) {
  const drag = useRef<Drag | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** Pointer position in viewBox units (the inverse of the svg's screen transform). */
  const toViewBox = (e: PointerEvent<SVGElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };

  const end = (e: PointerEvent<SVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drag.current = null;
    setDraggingId(null);
  };

  const readoutFor = participants.find((p) => p.id === (draggingId ?? edit.selectedId));

  return (
    <g data-editor="handles">
      {participants.map((p) => {
        const box = boxOf(p);
        const selected = edit.selectedId === p.id;
        const dragging = draggingId === p.id;
        return (
          <g
            key={p.id}
            data-editor="handle"
            data-id={p.id}
            className="group"
            transform={`translate(${p.x} ${p.y})`}
          >
            <rect
              x={-box.width / 2 - 4}
              y={-box.height / 2 - 4}
              width={box.width + 8}
              height={box.height + 8}
              rx={14}
              fill="transparent"
              strokeWidth={dragging ? 2.5 : 2}
              strokeDasharray={dragging ? undefined : "6 4"}
              className={`cursor-move ${
                dragging
                  ? "stroke-editor-handle-active"
                  : selected
                    ? "stroke-editor-handle"
                    : "stroke-transparent group-hover:stroke-editor-handle"
              }`}
              style={{ touchAction: "none" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                if (e.button !== 0 || !e.isPrimary) return;
                e.preventDefault();
                const at = toViewBox(e);
                if (!at) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: p.id, pointerId: e.pointerId, dx: at.x - p.x, dy: at.y - p.y };
                setDraggingId(p.id);
                edit.onSelect(p.id);
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.pointerId !== e.pointerId) return;
                const at = toViewBox(e);
                if (!at) return;
                const step = e.altKey ? null : edit.snap;
                const raw = { x: at.x - d.dx, y: at.y - d.dy };
                const placed = clampToViewBox(
                  step === null ? raw : { x: snap(raw.x, step), y: snap(raw.y, step) },
                  box,
                  viewBox,
                );
                if (placed.x !== p.x || placed.y !== p.y)
                  edit.onMoveParticipant(p.id, placed.x, placed.y);
              }}
              onPointerUp={end}
              onPointerCancel={end}
            />
          </g>
        );
      })}
      {readoutFor && <Readout participant={readoutFor} viewBox={viewBox} />}
    </g>
  );
}

/** Small "x, y" label on the selected or dragged box; flips below the box near the top edge. */
function Readout({ participant: p, viewBox }: { participant: Participant; viewBox: string }) {
  const text = `${Math.round(p.x)}, ${Math.round(p.y)}`;
  const top = Number(viewBox.split(" ")[1]) || 0;
  const above = p.y - NODE_HEIGHT / 2 - 30 >= top;
  const dy = above ? -NODE_HEIGHT / 2 - 18 : NODE_HEIGHT / 2 + 18;
  return (
    <g data-editor="readout" transform={`translate(${p.x} ${p.y + dy})`} pointerEvents="none">
      <rect
        x={-(text.length * 3.6 + 8)}
        y={-10}
        width={text.length * 7.2 + 16}
        height={20}
        rx={6}
        className="fill-editor-readout-bg"
      />
      <text
        y={4}
        textAnchor="middle"
        className="fill-editor-readout-fg text-[11px] font-mono select-none"
      >
        {text}
      </text>
    </g>
  );
}
