import { lazy, Suspense, useEffect, useMemo } from "react";
import { DEFAULT_VIEWBOX, type Box, type EdgeGeometry } from "@/lib/geometry";
import type { Participant, Relation } from "@/types/pattern";
import { useDiagramEdit, type DiagramEditContextValue } from "./DiagramEditContext";

// Dev-only: behind import.meta.env.DEV the bundler drops the dynamic import, so production builds contain no editor handles.
const EditHandles = import.meta.env.DEV
  ? lazy(() => import("./EditHandles").then((m) => ({ default: m.EditHandles })))
  : null;

export interface DiagramEditLayerProps {
  /** The boxes that can be dragged, in paint order (a later handle wins where two overlap). */
  participants: Participant[];
  /** The arrows whose `bend` can be dragged. Leave out arrows the scene draws without using `bend`. */
  relations: Relation[];
  /** Edge geometry by relation id, exactly as the scene draws it; each bend handle sits on its curve's midpoint. */
  geometry: Map<string, EdgeGeometry> | Record<string, EdgeGeometry>;
  viewBox?: string;
  /** Boxes the scene draws at a fixed size of its own (no width handle; handles match that size). */
  fixedSizes?: Readonly<Record<string, Pick<Box, "width" | "height">>>;
  /** Groups of participant ids that move as one: dragging any member moves every member by the same offset. */
  moveTogether?: readonly (readonly string[])[];
}

/**
 * The layout editor's hook into a diagram: registers the scene with the editor and draws its drag
 * handles. `<Diagram>` renders one itself; a scene that draws its own `<svg>` renders it last inside
 * that svg. Outside the dev-only layout editor it renders nothing.
 */
export function DiagramEditLayer({
  participants,
  relations,
  geometry,
  viewBox = DEFAULT_VIEWBOX,
  fixedSizes,
  moveTogether,
}: DiagramEditLayerProps) {
  const edit = useDiagramEdit();
  const register = edit?.register;
  useEffect(() => register?.(), [register]);

  const edges = useMemo(
    () => (geometry instanceof Map ? geometry : new Map(Object.entries(geometry))),
    [geometry],
  );

  const grouped = useMemo<DiagramEditContextValue | null>(() => {
    if (!edit || !moveTogether?.length) return edit;
    const byId = new Map(participants.map((p) => [p.id, p]));
    return {
      ...edit,
      onMoveParticipant: (id, x, y) => {
        const moved = byId.get(id);
        const group = moveTogether.find((g) => g.includes(id));
        if (!moved || !group) return edit.onMoveParticipant(id, x, y);
        for (const memberId of group) {
          const member = byId.get(memberId);
          if (member)
            edit.onMoveParticipant(memberId, member.x + x - moved.x, member.y + y - moved.y);
        }
      },
    };
  }, [edit, moveTogether, participants]);

  if (!grouped || !EditHandles) return null;
  return (
    <Suspense fallback={null}>
      <EditHandles
        edit={grouped}
        participants={participants}
        relations={relations}
        geometry={edges}
        viewBox={viewBox}
        fixedSizes={fixedSizes}
      />
    </Suspense>
  );
}
