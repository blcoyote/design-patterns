import { useCallback, useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export interface StepPlayer {
  index: number;
  count: number;
  playing: boolean;
  speed: number;
  /** Time the current step stays on screen, in ms. */
  interval: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  goTo: (i: number) => void;
  reset: () => void;
  setSpeed: (s: number) => void;
}

/**
 * Drives an auto-advancing, looping step index. Auto-play is off under reduced motion, and also
 * off when `initialIndex` is given (a deep link into a specific step), so the linked step stays
 * on screen instead of immediately advancing.
 * `durationOf(index, speed)` returns how long that step stays on screen in ms, so a step
 * with a long packet chain is not cut short (see `stepDuration` in src/lib/packetTiming.ts).
 */
export function useStepPlayer(
  count: number,
  durationOf: (index: number, speed: number) => number = (_index, speed) => 3200 / speed,
  initialIndex?: number,
): StepPlayer {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(initialIndex ?? 0);
  const [playing, setPlaying] = useState(initialIndex === undefined && !reduceMotion);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing || count < 2) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), durationOf(index, speed));
    return () => window.clearTimeout(id);
  }, [playing, index, count, speed, durationOf]);

  // @pattern iterator: Iterator-like — a cursor (index + next, prev, goTo) over the steps array keeps the steps plain data, though callers still index the array themselves
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(count - 1, i))), [count]);

  const current = Math.min(index, Math.max(0, count - 1));
  return {
    index: current,
    count,
    playing,
    speed,
    interval: durationOf(current, speed),
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    next,
    prev,
    goTo,
    reset: () => {
      setIndex(0);
      setPlaying(true);
    },
    setSpeed,
  };
}
