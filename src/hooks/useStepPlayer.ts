import { useCallback, useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

export interface StepPlayer {
  index: number
  count: number
  playing: boolean
  speed: number
  /** Current time per step in ms. */
  interval: number
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  goTo: (i: number) => void
  reset: () => void
  setSpeed: (s: number) => void
}

/** Drives an auto-advancing, looping step index. Auto-play is off under reduced motion. */
export function useStepPlayer(count: number, baseInterval = 3200): StepPlayer {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(!reduceMotion)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    if (!playing || count < 2) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), baseInterval / speed)
    return () => window.clearTimeout(id)
  }, [playing, index, count, speed, baseInterval])

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count])
  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count])
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(count - 1, i))), [count])

  return {
    index: Math.min(index, Math.max(0, count - 1)),
    count,
    playing,
    speed,
    interval: baseInterval / speed,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    toggle: () => setPlaying((p) => !p),
    next,
    prev,
    goTo,
    reset: () => {
      setIndex(0)
      setPlaying(true)
    },
    setSpeed,
  }
}
