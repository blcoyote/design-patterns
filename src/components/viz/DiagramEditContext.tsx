import { createContext, useContext } from "react";

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
  /** Select a participant, or clear the selection with `null`. */
  onSelect: (id: string | null) => void;
  /** Called by every mounted `<Diagram>`; returns the cleanup. Lets the page detect a scene without one. */
  register: () => () => void;
}

export const DiagramEditContext = createContext<DiagramEditContextValue | null>(null);

/** The editor context, or `null` when the diagram is not being edited. */
export function useDiagramEdit(): DiagramEditContextValue | null {
  return useContext(DiagramEditContext);
}
