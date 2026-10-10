import { createContext, useContext } from "react";
import type { WarningTargets } from "@/lib/layoutLint";

/**
 * What `<Diagram>` needs from a layout editor. There is no provider outside the
 * dev-only layout editor, and then `<Diagram>` renders exactly as it always has.
 */
export interface DiagramEditContextValue {
  /** Grid step in viewBox units that dragged boxes snap to; `null` disables snapping. Holding Alt also disables it. */
  snap: number | null;
  /** The participant currently selected in the editor, if any. */
  selectedId: string | null;
  /** Called while a box is dragged, with its new centre in viewBox units. */
  onMoveParticipant: (id: string, x: number, y: number) => void;
  /** Called while a relation's midpoint handle is dragged (or double-clicked, with 0), with its new `bend`. */
  onBendRelation: (id: string, bend: number) => void;
  /** Called while a box's width handle is dragged, with the new width in viewBox units (the centre stays put). */
  onResizeParticipant: (id: string, width: number) => void;
  /**
   * A drag gesture begins (pointer-down on any handle) / ends (pointer-up or cancel). Every
   * `onMoveParticipant` / `onResizeParticipant` / `onBendRelation` call in between belongs to one undo step. Single
   * discrete edits (double-click, a keyboard nudge) need neither: each is its own undo step.
   */
  onGestureStart: () => void;
  onGestureEnd: () => void;
  /** Select a participant, or clear the selection with `null`. */
  onSelect: (id: string | null) => void;
  /** Boxes, relation labels and curves to outline because the layout lint flagged them; none when omitted. */
  warnings?: WarningTargets;
  /** Called by every mounted `<Diagram>`; returns the cleanup. Lets the page detect a scene without one. */
  register: () => () => void;
}

export const DiagramEditContext = createContext<DiagramEditContextValue | null>(null);

/** The editor context, or `null` when the diagram is not being edited. */
export function useDiagramEdit(): DiagramEditContextValue | null {
  return useContext(DiagramEditContext);
}
