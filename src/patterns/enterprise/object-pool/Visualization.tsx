import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import type { Step, VisualizationProps } from "@/types/pattern";

/**
 * Object Pool keeps the generic structural diagram up top (Client A/B, the
 * ConnectionPool, Poolable, PooledConnection, Database) but replaces the usual
 * "stats strip" below it with a literal pool: three slots that light up on
 * acquire() and dim on release(), a visible waiting queue for callers who
 * arrive once every slot is taken, and a live in-use/idle/waiting readout.
 * A "Try it" row lets the visitor drive acquire()/release() by hand — those
 * clicks replay through the same diagram relations the step player uses, and
 * reset back to the authored step as soon as the step changes.
 */

const MAX_SIZE = 3;

type SlotState = "empty" | "idle" | "busy";

interface SlotScript {
  state: SlotState;
  owner?: string;
}

interface StepScript {
  slots: SlotScript[];
  queue: string[];
}

/** One scripted pool snapshot per step, telling the same story as `pattern.steps`. */
const SCRIPT: StepScript[] = [
  {
    slots: [{ state: "empty" }, { state: "empty" }, { state: "empty" }],
    queue: [],
  }, // 0: empty pool
  {
    slots: [{ state: "busy", owner: "A" }, { state: "empty" }, { state: "empty" }],
    queue: [],
  }, // 1: lazy create
  {
    slots: [{ state: "busy", owner: "A" }, { state: "empty" }, { state: "empty" }],
    queue: [],
  }, // 2: wraps resource
  {
    slots: [{ state: "idle" }, { state: "empty" }, { state: "empty" }],
    queue: [],
  }, // 3: release -> idle
  {
    slots: [
      { state: "busy", owner: "B" },
      { state: "busy", owner: "C" },
      { state: "busy", owner: "D" },
    ],
    queue: [],
  }, // 4: fill to max
  {
    slots: [
      { state: "busy", owner: "B" },
      { state: "busy", owner: "C" },
      { state: "busy", owner: "D" },
    ],
    queue: ["E"],
  }, // 5: exhausted
  {
    slots: [
      { state: "busy", owner: "B" },
      { state: "busy", owner: "E" },
      { state: "busy", owner: "D" },
    ],
    queue: [],
  }, // 6: handoff
  {
    slots: [
      { state: "busy", owner: "B" },
      { state: "busy", owner: "E" },
      { state: "busy", owner: "D" },
    ],
    queue: [],
  }, // 7: reset emphasis
  {
    slots: [
      { state: "busy", owner: "B" },
      { state: "busy", owner: "E" },
      { state: "busy", owner: "D" },
    ],
    queue: [],
  }, // 8: steady state
];

function statsOf(slots: SlotScript[], queue: string[]) {
  return {
    inUse: slots.filter((s) => s.state === "busy").length,
    idle: slots.filter((s) => s.state === "idle").length,
    waiting: queue.length,
  };
}

type ActionKind =
  "acquire-direct" | "acquire-create" | "acquire-queued" | "release-idle" | "release-handoff";

function syntheticStep(
  action: ActionKind,
  stats: { idle: number; inUse: number; waiting: number },
): Step {
  const noteText = `idle:${stats.idle} inUse:${stats.inUse} waiting:${stats.waiting}`;
  switch (action) {
    case "acquire-create":
    case "acquire-direct":
      return {
        title: "Try it: acquire()",
        description:
          "A slot is free (idle or never built), so the pool hands out a connection immediately.",
        highlight: [
          "acquireA",
          "connection",
          ...(action === "acquire-create" ? ["createConn"] : []),
        ],
        packets: [
          { relation: "acquireA", label: "acquire()" },
          ...(action === "acquire-create"
            ? [
                {
                  relation: "createConn",
                  label: "new PooledConnection()",
                  after: 0,
                },
              ]
            : []),
          {
            relation: "acquireA",
            label: "↩ conn",
            reverse: true,
            after: action === "acquire-create" ? 1 : 0,
          },
        ],
        notes: { pool: noteText },
      };
    case "acquire-queued":
      return {
        title: "Try it: acquire() — exhausted",
        description:
          "Every slot is busy and the pool is already at max size, so this caller is queued instead.",
        highlight: ["acquireB", "clientB"],
        packets: [{ relation: "acquireB", label: "acquire()" }],
        notes: { pool: noteText, clientB: "waiting…" },
      };
    case "release-idle":
      return {
        title: "Try it: release()",
        description:
          "Nobody is waiting, so the released connection is reset and goes back to idle.",
        highlight: ["releaseA", "connection"],
        packets: [{ relation: "releaseA", label: "release(conn)" }],
        notes: { pool: noteText },
      };
    case "release-handoff":
      return {
        title: "Try it: release() — handoff",
        description:
          "A caller is waiting, so the freed connection is reset and handed straight to it instead of going idle.",
        highlight: ["releaseA", "handoffB", "connection"],
        packets: [
          { relation: "releaseA", label: "release(conn)" },
          { relation: "handoffB", label: "resolve(conn)", after: 0 },
        ],
        notes: { pool: noteText, clientB: "acquired!" },
      };
  }
}

export function ObjectPoolVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();

  const scripted = SCRIPT[Math.min(stepIndex, SCRIPT.length - 1)];
  // Tag the override with the step it was fired on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const [override, setOverride] = useState<{
    forStep: number;
    slots: SlotScript[];
    queue: string[];
    synthetic: Step;
  } | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  // A-E are already spoken for by the scripted story; manual tries start at F.
  const letterRef = useRef(5);

  const liveOverride = override?.forStep === stepIndex ? override : null;
  const slots = liveOverride?.slots ?? scripted.slots;
  const queue = liveOverride?.queue ?? scripted.queue;
  const effectiveStep = liveOverride?.synthetic ?? step;
  const animationKey = liveOverride ? `override-${replayToken}` : stepIndex;
  const stats = statsOf(slots, queue);

  function nextLetter() {
    const letter = String.fromCharCode(65 + (letterRef.current % 26));
    letterRef.current += 1;
    return letter;
  }

  function commit(
    nextSlots: SlotScript[],
    nextQueue: string[],
    action: ActionKind,
    select: string,
  ) {
    setOverride({
      forStep: stepIndex,
      slots: nextSlots,
      queue: nextQueue,
      synthetic: syntheticStep(action, statsOf(nextSlots, nextQueue)),
    });
    setReplayToken((t) => t + 1);
    onSelect(select);
  }

  function acquire() {
    const nextSlots = slots.map((s) => ({ ...s }));
    const nextQueue = [...queue];
    const idleIdx = nextSlots.findIndex((s) => s.state === "idle");
    const emptyIdx = nextSlots.findIndex((s) => s.state === "empty");
    const letter = nextLetter();
    if (idleIdx !== -1) {
      nextSlots[idleIdx] = { state: "busy", owner: letter };
      commit(nextSlots, nextQueue, "acquire-direct", "connection");
    } else if (emptyIdx !== -1) {
      nextSlots[emptyIdx] = { state: "busy", owner: letter };
      commit(nextSlots, nextQueue, "acquire-create", "connection");
    } else {
      nextQueue.push(letter);
      commit(nextSlots, nextQueue, "acquire-queued", "clientB");
    }
  }

  function release() {
    const nextSlots = slots.map((s) => ({ ...s }));
    const nextQueue = [...queue];
    const busyIdx = nextSlots.findIndex((s) => s.state === "busy");
    if (busyIdx === -1) return;
    if (nextQueue.length > 0) {
      const owner = nextQueue.shift() as string;
      nextSlots[busyIdx] = { state: "busy", owner };
      commit(nextSlots, nextQueue, "release-handoff", "connection");
    } else {
      nextSlots[busyIdx] = { state: "idle" };
      commit(nextSlots, nextQueue, "release-idle", "connection");
    }
  }

  const canRelease = stats.inUse > 0;

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={effectiveStep?.highlight}
        packets={effectiveStep?.packets}
        packetSpeed={speed}
        notes={effectiveStep?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        ariaLabel={`${pattern.name} diagram`}
      />

      <div className="flex flex-wrap items-stretch gap-3 border-t border-slate-800 p-3">
        <div className="min-w-[320px] flex-1 rounded-lg bg-slate-950/40 p-3 ring-1 ring-slate-800">
          <div className="mb-2 text-xs font-mono uppercase tracking-wider text-slate-500">
            pool · max size {MAX_SIZE}
          </div>
          <div className="flex gap-3">
            {slots.map((slot, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slot ${i + 1}: ${slot.state}${slot.owner ? ` — borrower ${slot.owner}` : ""}`}
                aria-pressed={selectedId === "connection"}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect("connection");
                }}
                className="flex h-20 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-xs font-mono outline-none focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  background: slot.state === "busy" ? `${color}22` : "rgba(15,23,42,0.4)",
                  boxShadow:
                    slot.state === "busy"
                      ? `inset 0 0 0 2px ${color}`
                      : slot.state === "idle"
                        ? "inset 0 0 0 1.5px #475569"
                        : "inset 0 0 0 1.5px #334155",
                  borderStyle: slot.state === "empty" ? "dashed" : "solid",
                }}
              >
                <span className="text-slate-500">slot {i + 1}</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${slot.state}-${slot.owner ?? ""}`}
                    initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 22 }
                    }
                    className="text-base font-bold"
                    style={{ color: slot.state === "busy" ? color : "#64748b" }}
                  >
                    {slot.state === "busy" ? slot.owner : slot.state === "idle" ? "idle" : "—"}
                  </motion.span>
                </AnimatePresence>
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              waiting
            </span>
            <div className="flex min-h-7 flex-1 flex-wrap items-center gap-1.5 rounded bg-slate-900/60 px-2 py-1">
              {queue.length === 0 && <span className="text-xs text-slate-600">— none —</span>}
              <AnimatePresence>
                {queue.map((owner, i) => (
                  <motion.span
                    key={`${owner}-${i}`}
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                    className="rounded-full px-2 py-0.5 text-xs font-mono font-bold text-slate-950"
                    style={{ backgroundColor: color }}
                  >
                    {owner}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="flex min-w-50 flex-col justify-between gap-2 rounded-lg bg-slate-950/40 p-3 ring-1 ring-slate-800">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              In use
            </span>
            <span className="font-mono text-sm font-bold" style={{ color }}>
              {stats.inUse}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Idle</span>
            <span className="font-mono text-sm font-bold text-slate-200">{stats.idle}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
              Waiting
            </span>
            <span className="font-mono text-sm font-bold text-slate-200">{stats.waiting}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 border-t border-slate-800 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-600">
              Try it
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                acquire();
              }}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-950 transition focus-visible:outline-2 focus-visible:outline-white"
              style={{ backgroundColor: color }}
            >
              acquire()
            </button>
            <button
              type="button"
              disabled={!canRelease}
              onClick={(e) => {
                e.stopPropagation();
                release();
              }}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              release()
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
