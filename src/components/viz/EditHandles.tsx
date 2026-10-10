import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { onActivate } from "@/lib/a11y";
import { NODE_HEIGHT, boxOf, type EdgeGeometry, type Point } from "@/lib/geometry";
import { bendForPoint, clampToViewBox, clampWidth, snap } from "@/lib/layoutEdit";
import { labelRect, relationLabel } from "@/lib/layoutLint";
import type { Participant, Relation } from "@/types/pattern";
import type { DiagramEditContextValue } from "./DiagramEditContext";

export interface EditHandlesProps {
  edit: DiagramEditContextValue;
  participants: Participant[];
  relations: Relation[];
  /** Edge geometry by relation id, as computed by `<Diagram>`; each bend handle sits on its curve's midpoint. */
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

/** Pointer position in viewBox units (the inverse of the svg's screen transform). */
function toViewBox(e: PointerEvent<SVGElement>): Point | null {
  const svg = e.currentTarget.ownerSVGElement;
  const matrix = svg?.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

const ARROW_KEYS: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** Keyboard nudge of an arrow key: a unit vector in screen directions and its size (Shift = 10). Modified keys are left to the browser. */
function nudgeOf(e: KeyboardEvent): { dir: Point; step: number } | null {
  const dir = ARROW_KEYS[e.key];
  if (!dir || e.ctrlKey || e.metaKey || e.altKey) return null;
  return { dir, step: e.shiftKey ? 10 : 1 };
}

/**
 * +1 or -1: whether `bend` should rise or fall to move a curve's midpoint towards screen direction
 * `dir`. A positive bend pushes the midpoint along (-dy, dx) of the chord; an arrow across that
 * direction has no effect either way, so Up / Right count as "rise" then.
 */
function bendSign(dir: Point, from: Point, to: Point): 1 | -1 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const along = (dir.x * -dy + dir.y * dx) / (Math.hypot(dx, dy) || 1);
  if (Math.abs(along) > 0.3) return along > 0 ? 1 : -1;
  return dir.x - dir.y >= 0 ? 1 : -1;
}

/** Largest bend a handle can express (matches `bendForPoint`'s saturation). */
const BEND_LIMIT = 600;

/**
 * Editor layer drawn last inside a `<Diagram>`'s svg: one drag handle per
 * participant, then one bend handle per relation (on top, so a handle stays
 * reachable when a box outline covers the curve's midpoint).
 */
export function EditHandles({
  edit,
  participants,
  relations,
  geometry,
  viewBox,
}: EditHandlesProps) {
  const drag = useRef<Drag | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  const end = (e: PointerEvent<SVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.current) edit.onGestureEnd();
    drag.current = null;
    setDraggingId(null);
  };

  const readoutFor = participants.find((p) => p.id === (draggingId ?? edit.selectedId));
  const selected = participants.find((p) => p.id === edit.selectedId);

  return (
    <g data-editor="handles">
      {edit.warnings && (
        <WarningOutlines
          warnings={edit.warnings}
          participants={participants}
          relations={relations}
          geometry={geometry}
        />
      )}
      {participants.map((p) => {
        const box = boxOf(p);
        const isSelected = edit.selectedId === p.id;
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
              className={`cursor-move outline-none focus-visible:stroke-editor-handle-active focus-visible:[stroke-dasharray:none] ${
                dragging
                  ? "stroke-editor-handle-active"
                  : isSelected
                    ? "stroke-editor-handle"
                    : "stroke-transparent group-hover:stroke-editor-handle"
              }`}
              style={{ touchAction: "none" }}
              tabIndex={0}
              role="button"
              aria-label={`Move ${p.label}`}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => edit.onSelect(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  edit.onSelect(null);
                  return;
                }
                const nudge = nudgeOf(e);
                if (!nudge) return onActivate(() => edit.onSelect(p.id))(e);
                // Page must not scroll; each key press is its own undo step (no gesture needed).
                e.preventDefault();
                const placed = clampToViewBox(
                  { x: p.x + nudge.dir.x * nudge.step, y: p.y + nudge.dir.y * nudge.step },
                  box,
                  viewBox,
                );
                if (placed.x !== p.x || placed.y !== p.y)
                  edit.onMoveParticipant(p.id, placed.x, placed.y);
              }}
              onPointerDown={(e) => {
                if (e.button !== 0 || !e.isPrimary) return;
                e.preventDefault();
                const at = toViewBox(e);
                if (!at) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { id: p.id, pointerId: e.pointerId, dx: at.x - p.x, dy: at.y - p.y };
                setDraggingId(p.id);
                edit.onGestureStart();
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
                  // free placement still lands on whole units: the value is saved into index.ts
                  step === null
                    ? { x: Math.round(raw.x), y: Math.round(raw.y) }
                    : { x: snap(raw.x, step), y: snap(raw.y, step) },
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
      {relations.map((r) => {
        const g = geometry.get(r.id);
        const from = participants.find((p) => p.id === r.from);
        const to = participants.find((p) => p.id === r.to);
        // No handle for self-relations or relations whose endpoints are missing.
        if (!g || !from || !to || from === to) return null;
        return (
          <BendHandle
            key={r.id}
            edit={edit}
            relation={r}
            geometry={g}
            from={from}
            to={to}
            viewBox={viewBox}
          />
        );
      })}
      {selected && (
        <WidthHandle
          key={selected.id}
          edit={edit}
          participant={selected}
          viewBox={viewBox}
          onResizing={setResizing}
        />
      )}
      {readoutFor && !resizing && <Readout participant={readoutFor} viewBox={viewBox} />}
    </g>
  );
}

/** Outlines (drawn beneath the handles, never hit-tested) around what the layout lint flagged. */
function WarningOutlines({
  warnings,
  participants,
  relations,
  geometry,
}: {
  warnings: NonNullable<DiagramEditContextValue["warnings"]>;
  participants: Participant[];
  relations: Relation[];
  geometry: Map<string, EdgeGeometry>;
}) {
  return (
    <g data-editor="warnings" pointerEvents="none">
      {relations.map((r) => {
        const g = geometry.get(r.id);
        if (!g) return null;
        const label = relationLabel(r);
        const rect = label === undefined ? null : labelRect(label, g.mid);
        return (
          <g key={r.id}>
            {warnings.edges.has(r.id) && (
              <path
                data-editor="warning-edge"
                data-id={r.id}
                d={g.d}
                fill="none"
                strokeWidth={4}
                strokeLinecap="round"
                className="stroke-editor-warn opacity-60"
              />
            )}
            {rect && warnings.labels.has(r.id) && (
              <rect
                data-editor="warning-label"
                data-id={r.id}
                x={rect.x - rect.width / 2 - 3}
                y={rect.y - rect.height / 2 - 3}
                width={rect.width + 6}
                height={rect.height + 6}
                rx={8}
                fill="none"
                strokeWidth={2}
                className="stroke-editor-warn"
              />
            )}
          </g>
        );
      })}
      {participants
        .filter((p) => warnings.participants.has(p.id))
        .map((p) => {
          const box = boxOf(p);
          return (
            <rect
              key={p.id}
              data-editor="warning-box"
              data-id={p.id}
              x={p.x - box.width / 2 - 8}
              y={p.y - box.height / 2 - 8}
              width={box.width + 16}
              height={box.height + 16}
              rx={18}
              fill="none"
              strokeWidth={2.5}
              className="stroke-editor-warn"
            />
          );
        })}
    </g>
  );
}

interface BendDrag {
  pointerId: number;
  /** Pointer position minus the curve midpoint at pointer-down, so the handle does not jump. */
  dx: number;
  dy: number;
}

interface BendHandleProps {
  edit: DiagramEditContextValue;
  relation: Relation;
  geometry: EdgeGeometry;
  from: Participant;
  to: Participant;
  viewBox: string;
}

/**
 * Drag handle on a relation's curve midpoint. Dragging sets `bend` so that the
 * midpoint follows the pointer (snapped unless Alt is held); double-click
 * straightens the curve.
 */
function BendHandle({ edit, relation, geometry, from, to, viewBox }: BendHandleProps) {
  const drag = useRef<BendDrag | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const bend = relation.bend ?? 0;
  const { mid } = geometry;

  const end = (e: PointerEvent<SVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.current) edit.onGestureEnd();
    drag.current = null;
    setDragging(false);
  };

  const straighten = () => {
    if (bend !== 0) edit.onBendRelation(relation.id, 0);
  };

  return (
    <g data-editor="bend-handle" data-id={relation.id}>
      {dragging && (
        <path
          d={geometry.d}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className="stroke-editor-handle-active"
          pointerEvents="none"
        />
      )}
      <g
        transform={`translate(${mid.x} ${mid.y})`}
        className={`group outline-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ touchAction: "none" }}
        tabIndex={0}
        role="button"
        aria-label={`Bend ${relation.label ?? relation.id}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            edit.onSelect(null);
            return;
          }
          const nudge = nudgeOf(e);
          if (!nudge) return onActivate(() => straighten())(e);
          // The arrow moves the curve's midpoint that way where it can. Each key press is its own undo step.
          e.preventDefault();
          const next = Math.max(
            -BEND_LIMIT,
            Math.min(BEND_LIMIT, bend + bendSign(nudge.dir, from, to) * nudge.step),
          );
          if (next !== bend) edit.onBendRelation(relation.id, next);
        }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          straighten();
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          e.preventDefault();
          const at = toViewBox(e);
          if (!at) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { pointerId: e.pointerId, dx: at.x - mid.x, dy: at.y - mid.y };
          setDragging(true);
          edit.onGestureStart();
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const at = toViewBox(e);
          if (!at) return;
          const raw = bendForPoint(boxOf(from), boxOf(to), { x: at.x - d.dx, y: at.y - d.dy });
          const step = e.altKey ? null : edit.snap;
          const next = step === null ? raw : snap(raw, step);
          if (next !== bend) edit.onBendRelation(relation.id, next);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <title>Drag or use arrow keys to bend, double-click or Enter to straighten</title>
        <circle r={14} fill="transparent" />
        <circle
          r={11}
          fill="none"
          strokeWidth={2}
          className="stroke-transparent group-focus-visible:stroke-editor-handle-active"
        />
        <circle
          r={dragging ? 7 : 6}
          strokeWidth={2}
          className={`stroke-editor-readout-fg ${
            dragging ? "fill-editor-handle-active" : "fill-editor-handle"
          } ${dragging || hovered ? "" : "opacity-70"}`}
        />
      </g>
      {dragging && <Chip text={`bend: ${bend}`} x={mid.x} y={mid.y} viewBox={viewBox} />}
    </g>
  );
}

interface WidthDrag {
  pointerId: number;
  /** Pointer position minus the box's right edge at pointer-down, so the handle does not jump. */
  dx: number;
}

/**
 * Handle on the right edge of the selected box. Dragging sets `width` so the right edge follows the
 * pointer while the centre stays fixed (the left edge mirrors it); snapped unless Alt is held.
 */
function WidthHandle({
  edit,
  participant: p,
  viewBox,
  onResizing,
}: {
  edit: DiagramEditContextValue;
  participant: Participant;
  viewBox: string;
  onResizing: (resizing: boolean) => void;
}) {
  const drag = useRef<WidthDrag | null>(null);
  const [dragging, setDragging] = useState(false);
  const { width } = boxOf(p);
  const edgeX = p.x + width / 2;

  const end = (e: PointerEvent<SVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.current) edit.onGestureEnd();
    drag.current = null;
    setDragging(false);
    onResizing(false);
  };

  return (
    <g data-editor="width-handle" data-id={p.id}>
      <g
        transform={`translate(${edgeX} ${p.y})`}
        className="group cursor-ew-resize outline-none"
        style={{ touchAction: "none" }}
        tabIndex={0}
        role="slider"
        aria-label={`Width of ${p.label}`}
        aria-orientation="horizontal"
        aria-valuemin={clampWidth(0, viewBox)}
        aria-valuemax={clampWidth(Infinity, viewBox)}
        aria-valuenow={width}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            edit.onSelect(null);
            return;
          }
          const nudge = nudgeOf(e);
          if (!nudge) return;
          // Right / Up widen, Left / Down narrow. Each key press is its own undo step.
          e.preventDefault();
          const next = clampWidth(
            width + (nudge.dir.x + -nudge.dir.y > 0 ? 1 : -1) * nudge.step,
            viewBox,
          );
          if (next !== width) edit.onResizeParticipant(p.id, next);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || !e.isPrimary) return;
          e.preventDefault();
          const at = toViewBox(e);
          if (!at) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { pointerId: e.pointerId, dx: at.x - edgeX };
          setDragging(true);
          onResizing(true);
          edit.onGestureStart();
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const at = toViewBox(e);
          if (!at) return;
          const raw = 2 * (at.x - d.dx - p.x);
          const step = e.altKey ? null : edit.snap;
          const next = clampWidth(step === null ? Math.round(raw) : snap(raw, step), viewBox);
          if (next !== width) edit.onResizeParticipant(p.id, next);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <title>Drag or use arrow keys to resize the width</title>
        <rect x={-14} y={-20} width={28} height={40} fill="transparent" />
        <rect
          x={-9}
          y={-17}
          width={18}
          height={34}
          rx={6}
          fill="none"
          strokeWidth={2}
          className="stroke-transparent group-focus-visible:stroke-editor-handle-active"
        />
        <rect
          x={-5}
          y={-13}
          width={10}
          height={26}
          rx={4}
          strokeWidth={2}
          className={`stroke-editor-readout-fg ${
            dragging ? "fill-editor-handle-active" : "fill-editor-handle"
          }`}
        />
      </g>
      {dragging && <Chip text={`width: ${width}`} x={edgeX} y={p.y} viewBox={viewBox} />}
    </g>
  );
}

/** Small "x, y" label on the selected or dragged box; flips below the box near the top edge. */
function Readout({ participant: p, viewBox }: { participant: Participant; viewBox: string }) {
  return (
    <Chip
      text={`${Math.round(p.x)}, ${Math.round(p.y)}`}
      x={p.x}
      y={p.y}
      clearance={NODE_HEIGHT / 2}
      viewBox={viewBox}
    />
  );
}

/** Readout chip centred above (`x`, `y`) by `clearance` + 18, or below when that would leave the viewBox. */
function Chip({
  text,
  x,
  y,
  clearance = 10,
  viewBox,
}: {
  text: string;
  x: number;
  y: number;
  clearance?: number;
  viewBox: string;
}) {
  const top = Number(viewBox.split(" ")[1]) || 0;
  const above = y - clearance - 30 >= top;
  const dy = above ? -clearance - 18 : clearance + 18;
  return (
    <g data-editor="readout" transform={`translate(${x} ${y + dy})`} pointerEvents="none">
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
