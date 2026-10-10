import { useCallback, useEffect, useMemo, useReducer } from "react";
import { emptyLayout, isEmpty, type LayoutOverrides } from "@/lib/layoutEdit";

/** One layout change a user can revert on its own: all overrides of one participant or relation. */
export interface ChangeTarget {
  kind: "participant" | "relation";
  id: string;
}

export interface LayoutHistoryState {
  past: LayoutOverrides[];
  present: LayoutOverrides;
  future: LayoutOverrides[];
  /** While a drag gesture is open: `present` as it was when the gesture started. */
  gestureBase: LayoutOverrides | null;
}

export type LayoutHistoryAction =
  | { type: "gestureStart" }
  | { type: "gestureEnd" }
  /** `update` must be pure: React may call it twice. */
  | { type: "update"; update: (current: LayoutOverrides) => LayoutOverrides }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" }
  | { type: "revert"; target: ChangeTarget }
  /** `saved` (the overrides as they were when the save started) are now in the source file. */
  | { type: "saved"; saved: LayoutOverrides };

export function initialHistory(present: LayoutOverrides = emptyLayout()): LayoutHistoryState {
  return { past: [], present, future: [], gestureBase: null };
}

type Patch = Record<string, Record<string, number | undefined>>;

function patchesEqual(a: Patch, b: Patch): boolean {
  const live = (patch: Patch) =>
    Object.entries(patch).flatMap(([id, values]) =>
      Object.entries(values)
        .filter(([, v]) => v !== undefined)
        .map(([field, v]) => `${id}\u0000${field}\u0000${v}`),
    );
  const left = live(a).sort();
  const right = live(b).sort();
  return left.length === right.length && left.every((entry, i) => entry === right[i]);
}

/** Structural equality of two overrides, ignoring `undefined` values and key order. */
export function layoutsEqual(a: LayoutOverrides, b: LayoutOverrides): boolean {
  return patchesEqual(a.participants, b.participants) && patchesEqual(a.relations, b.relations);
}

/** Records `previous` as an undo step and drops the redo stack; unchanged overrides leave `state` as is. */
function commit(
  state: LayoutHistoryState,
  previous: LayoutOverrides,
  present: LayoutOverrides,
): LayoutHistoryState {
  if (layoutsEqual(previous, present)) return state;
  return { ...state, past: [...state.past, previous], present, future: [] };
}

/**
 * Pure history reducer. A drag gesture is `gestureStart`, many `update`s and one `gestureEnd`: the
 * updates replace `present` live and the whole gesture becomes a single undo entry (none if it
 * ended where it began). An `update` outside a gesture is its own entry. Undo and redo are ignored
 * while a gesture is open.
 */
export function layoutHistoryReducer(
  state: LayoutHistoryState,
  action: LayoutHistoryAction,
): LayoutHistoryState {
  switch (action.type) {
    case "gestureStart":
      return state.gestureBase ? state : { ...state, gestureBase: state.present };
    case "gestureEnd": {
      if (!state.gestureBase) return state;
      const base = state.gestureBase;
      return commit({ ...state, gestureBase: null }, base, state.present);
    }
    case "update": {
      const next = action.update(state.present);
      if (state.gestureBase) return { ...state, present: next };
      return commit(state, state.present, next);
    }
    case "undo": {
      if (state.gestureBase || state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      if (state.gestureBase || state.future.length === 0) return state;
      const [next, ...rest] = state.future;
      return { ...state, past: [...state.past, state.present], present: next, future: rest };
    }
    case "reset":
      if (state.gestureBase || isEmpty(state.present)) return state;
      return commit(state, state.present, emptyLayout());
    case "revert": {
      if (state.gestureBase) return state;
      const { kind, id } = action.target;
      const present = state.present;
      const without = <T>(record: Record<string, T>): Record<string, T> => {
        const { [id]: _removed, ...rest } = record;
        return rest;
      };
      const next: LayoutOverrides =
        kind === "participant"
          ? { ...present, participants: without(present.participants) }
          : { ...present, relations: without(present.relations) };
      return commit(state, present, next);
    }
    case "saved":
      // Edits made while the save was in flight stay (as the same overrides: re-applying values
      // equal to the saved ones changes nothing); otherwise the file now holds them all, so
      // history starts over.
      if (state.gestureBase || !layoutsEqual(state.present, action.saved)) return state;
      return initialHistory();
  }
}

export interface LayoutHistory {
  overrides: LayoutOverrides;
  canUndo: boolean;
  canRedo: boolean;
  /** Change the overrides: live inside a gesture, otherwise one undo entry. */
  update: (update: (current: LayoutOverrides) => LayoutOverrides) => void;
  /** Open a drag gesture: everything until `gestureEnd` becomes one undo entry. */
  gestureStart: () => void;
  gestureEnd: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  revert: (target: ChangeTarget) => void;
  /** Call once `saved` (the overrides at the time of the save) is written: clears overrides and history if nothing changed since. */
  markSaved: (saved: LayoutOverrides) => void;
}

/** Undo/redo history of a `LayoutOverrides`, seeded by `initial` (read once). */
export function useLayoutHistory(initial: () => LayoutOverrides): LayoutHistory {
  const [state, dispatch] = useReducer(layoutHistoryReducer, undefined, () =>
    initialHistory(initial()),
  );
  const update = useCallback(
    (fn: (current: LayoutOverrides) => LayoutOverrides) => dispatch({ type: "update", update: fn }),
    [],
  );
  const actions = useMemo(
    () => ({
      gestureStart: () => dispatch({ type: "gestureStart" }),
      gestureEnd: () => dispatch({ type: "gestureEnd" }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      reset: () => dispatch({ type: "reset" }),
      revert: (target: ChangeTarget) => dispatch({ type: "revert", target }),
      markSaved: (saved: LayoutOverrides) => dispatch({ type: "saved", saved }),
    }),
    [],
  );
  return {
    overrides: state.present,
    canUndo: state.past.length > 0 && !state.gestureBase,
    canRedo: state.future.length > 0 && !state.gestureBase,
    update,
    ...actions,
  };
}

/** Which history command a key press means: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y. */
export function historyShortcut(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): "undo" | "redo" | null {
  if (e.altKey || (!e.ctrlKey && !e.metaKey)) return null;
  const key = e.key.toLowerCase();
  if (key === "z") return e.shiftKey ? "redo" : "undo";
  if (key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey) return "redo";
  return null;
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
  );
}

/** Window-level undo/redo shortcuts; leaves text fields to the browser's own undo. */
export function useHistoryShortcuts(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const command = historyShortcut(e);
      if (!command || isTextEntry(e.target)) return;
      e.preventDefault();
      if (command === "undo") undo();
      else redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);
}
