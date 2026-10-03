import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import { boxOf, edgeBetween, NODE_HEIGHT } from "@/lib/geometry";
import type { Packet, Step, VisualizationProps } from "@/types/pattern";

/**
 * Circuit Breaker keeps the generic diagram's layout (Client / CircuitBreaker /
 * RemoteService, plus a Closed-Open-Half-Open ring) but adds a glowing connector —
 * exactly like State's — that springs from CircuitBreaker to whichever mode is
 * current, a failure meter that fills toward the trip threshold, and a live
 * cooldown readout while Open. A "Try it" row lets the visitor flip RemoteService
 * healthy/failing and fire requests themselves, independent of the step player —
 * including a real cooldown timer that promotes Open to Half-Open on its own.
 */

type BreakerState = "closed" | "open" | "halfOpen";
type EventKind = "success" | "failure" | "failFast" | "cooldown";

const STATE_IDS: BreakerState[] = ["closed", "open", "halfOpen"];

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MS = 4000;

/** Failure counter shown at each scripted step, aligned 1:1 with pattern.steps. */
const FAILURE_COUNTS_BY_STEP = [0, 1, 2, 3, 3, 3, 3, 0, 3];

/** Which mode a step's highlight set is "about" — the one the connector should point at. */
function stateFromStep(step: Step | null): BreakerState {
  if (step) {
    for (const id of STATE_IDS) {
      if (step.highlight.includes(id)) return id;
    }
  }
  return "closed";
}

interface LiveState {
  forStep: number;
  prevState: BreakerState;
  state: BreakerState;
  failureCount: number;
  cooldownEndsAt: number | null;
  event: EventKind;
  token: number;
}

/** Builds the highlight/packets/notes for one live Try-it event. */
function describeEvent(
  prev: BreakerState,
  next: BreakerState,
  event: EventKind,
  failureCount: number,
): { highlight: string[]; packets: Packet[]; notes: Record<string, string> } {
  if (event === "failFast") {
    return {
      highlight: ["client", "request", "open", "state-open"],
      packets: [
        { relation: "request", label: "call(fn)" },
        { relation: "request", label: "fail fast ⚡", reverse: true, after: 0 },
      ],
      notes: { breaker: "OPEN — fail fast", service: "untouched" },
    };
  }
  if (event === "cooldown") {
    return {
      highlight: ["cooldown", "halfOpen", "state-halfOpen"],
      packets: [{ relation: "cooldown", label: "cooldown elapsed" }],
      notes: { breaker: "HALF_OPEN", halfOpen: "trial pending" },
    };
  }
  const transition =
    next === prev
      ? []
      : next === "open"
        ? [prev === "halfOpen" ? "trial-failure" : "trip", "open"]
        : ["trial-success", "closed"];
  return {
    highlight: ["client", "request", "forward", "service", ...transition],
    packets: [
      { relation: "request", label: "call(fn)" },
      { relation: "forward", label: "fn()", after: 0 },
      {
        relation: "forward",
        label: event === "success" ? "ok" : "error",
        reverse: true,
        after: 1,
      },
      ...(next === prev
        ? []
        : [
            {
              relation: transition[0],
              label: next === "open" ? "⇒ OPEN" : "⇒ CLOSED",
              after: 2,
            },
          ]),
      {
        relation: "request",
        label: event === "success" ? "ok" : "error",
        reverse: true,
        after: next === prev ? 2 : 3,
      },
    ],
    notes: {
      breaker: `failures: ${Math.min(failureCount, FAILURE_THRESHOLD)}/${FAILURE_THRESHOLD}`,
      service: event === "success" ? "healthy" : "failing",
    },
  };
}

export function CircuitBreakerVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();

  const [healthy, setHealthy] = useState(true);
  const [live, setLive] = useState<LiveState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const tokenRef = useRef(0);

  // Tag the override with the step it was fired on, so it derives back to "no
  // override" as soon as the step player moves on — no effect/sync needed.
  const effectiveLive = live?.forStep === stepIndex ? live : null;

  const byId = useMemo(
    () => new Map(pattern.participants.map((p) => [p.id, p])),
    [pattern.participants],
  );
  const relById = useMemo(
    () => new Map(pattern.relations.map((r) => [r.id, r])),
    [pattern.relations],
  );

  const baseActiveId = stateFromStep(step);
  const baseFailureCount =
    FAILURE_COUNTS_BY_STEP[Math.min(stepIndex, FAILURE_COUNTS_BY_STEP.length - 1)] ?? 0;

  const activeId = effectiveLive ? effectiveLive.state : baseActiveId;
  const failureCount = effectiveLive ? effectiveLive.failureCount : baseFailureCount;

  const liveDisplay = effectiveLive
    ? describeEvent(
        effectiveLive.prevState,
        effectiveLive.state,
        effectiveLive.event,
        effectiveLive.failureCount,
      )
    : null;
  const displayHighlight = liveDisplay?.highlight ?? step?.highlight;
  const displayPackets = liveDisplay?.packets ?? step?.packets;
  const displayNotes = liveDisplay?.notes ?? step?.notes;
  const animationKey = effectiveLive ? `live-${effectiveLive.token}` : stepIndex;

  // Auto-promote Open -> Half-Open once the cooldown elapses, exactly like the
  // real CircuitBreaker checks `Date.now() < nextAttempt` on the next call.
  useEffect(() => {
    if (!effectiveLive || effectiveLive.state !== "open" || effectiveLive.cooldownEndsAt == null)
      return;
    const endsAt = effectiveLive.cooldownEndsAt;
    const forStep = effectiveLive.forStep;
    const remaining = Math.max(0, endsAt - Date.now());
    const id = setTimeout(() => {
      setLive((prev) => {
        if (
          !prev ||
          prev.forStep !== forStep ||
          prev.state !== "open" ||
          prev.cooldownEndsAt !== endsAt
        )
          return prev;
        tokenRef.current += 1;
        return {
          forStep,
          prevState: "open",
          state: "halfOpen",
          failureCount: prev.failureCount,
          cooldownEndsAt: null,
          event: "cooldown",
          token: tokenRef.current,
        };
      });
      onSelect("halfOpen");
    }, remaining);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLive]);

  // Tick the cooldown countdown while Open, so the "Try it" row shows real progress.
  useEffect(() => {
    if (
      reduceMotion ||
      !effectiveLive ||
      effectiveLive.state !== "open" ||
      effectiveLive.cooldownEndsAt == null
    )
      return;
    const id = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(id);
  }, [reduceMotion, effectiveLive]);

  const cooldownRemainingMs =
    effectiveLive?.state === "open" && effectiveLive.cooldownEndsAt != null
      ? Math.max(0, effectiveLive.cooldownEndsAt - now)
      : 0;

  function sendRequest() {
    const current = effectiveLive ?? {
      state: baseActiveId,
      failureCount: baseFailureCount,
    };

    if (current.state === "open") {
      tokenRef.current += 1;
      setLive({
        forStep: stepIndex,
        prevState: "open",
        state: "open",
        failureCount: current.failureCount,
        cooldownEndsAt: effectiveLive?.cooldownEndsAt ?? Date.now() + COOLDOWN_MS,
        event: "failFast",
        token: tokenRef.current,
      });
      onSelect("open");
      return;
    }

    if (healthy) {
      tokenRef.current += 1;
      setLive({
        forStep: stepIndex,
        prevState: current.state,
        state: "closed",
        failureCount: 0,
        cooldownEndsAt: null,
        event: "success",
        token: tokenRef.current,
      });
      onSelect("closed");
      return;
    }

    let nextState: BreakerState = current.state;
    let nextFailureCount = current.failureCount;
    let cooldownEndsAt: number | null = null;
    if (current.state === "halfOpen") {
      nextState = "open";
      cooldownEndsAt = Date.now() + COOLDOWN_MS;
    } else {
      nextFailureCount = current.failureCount + 1;
      if (nextFailureCount >= FAILURE_THRESHOLD) {
        nextState = "open";
        cooldownEndsAt = Date.now() + COOLDOWN_MS;
      }
    }
    tokenRef.current += 1;
    setLive({
      forStep: stepIndex,
      prevState: current.state,
      state: nextState,
      failureCount: nextFailureCount,
      cooldownEndsAt,
      event: "failure",
      token: tokenRef.current,
    });
    onSelect(nextState === "open" ? "open" : current.state);
  }

  const breakerP = byId.get("breaker");
  const openP = byId.get("open");
  const activeParticipant = byId.get(activeId);
  const connector =
    breakerP && activeParticipant
      ? edgeBetween(
          boxOf(breakerP),
          boxOf(activeParticipant),
          relById.get(`state-${activeId}`)?.bend ?? 0,
        )
      : null;

  const springTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 220, damping: 24 };
  const meterPct = Math.min(failureCount, FAILURE_THRESHOLD) / FAILURE_THRESHOLD;

  const overlay = (
    <>
      {breakerP && activeParticipant && connector && (
        <motion.g pointerEvents="none">
          <motion.path
            d={connector.d}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.85}
            filter="url(#glow)"
            initial={false}
            animate={{ d: connector.d }}
            transition={springTransition}
          />
          <motion.circle
            r={5}
            fill="#ffffff"
            initial={false}
            animate={{ cx: connector.start.x, cy: connector.start.y }}
            transition={springTransition}
          />
          <motion.circle
            r={5}
            fill={color}
            initial={false}
            animate={{ cx: connector.end.x, cy: connector.end.y }}
            transition={springTransition}
          />
        </motion.g>
      )}

      {breakerP && (
        <g
          transform={`translate(${breakerP.x - 70} ${breakerP.y + NODE_HEIGHT / 2 + 30})`}
          pointerEvents="none"
        >
          <rect x={0} y={0} width={140} height={8} rx={4} fill="#1e293b" />
          <motion.rect
            x={0}
            y={0}
            height={8}
            rx={4}
            fill={failureCount >= FAILURE_THRESHOLD ? "#f87171" : color}
            initial={false}
            animate={{ width: 140 * meterPct }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }
            }
          />
          <text
            x={70}
            y={22}
            textAnchor="middle"
            className="fill-slate-400 text-[10px] font-mono select-none"
          >
            {`failures ${Math.min(failureCount, FAILURE_THRESHOLD)}/${FAILURE_THRESHOLD}`}
          </text>
        </g>
      )}

      {effectiveLive?.state === "open" && effectiveLive.cooldownEndsAt != null && openP && (
        <g
          transform={`translate(${openP.x} ${openP.y + NODE_HEIGHT / 2 + 26})`}
          pointerEvents="none"
        >
          <text textAnchor="middle" className="fill-slate-400 text-[10px] font-mono select-none">
            {reduceMotion
              ? "cooling down…"
              : `cooldown ${(cooldownRemainingMs / 1000).toFixed(1)}s`}
          </text>
        </g>
      )}
    </>
  );

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={displayHighlight}
        packets={displayPackets}
        packetSpeed={speed}
        notes={displayNotes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={animationKey}
        overlay={overlay}
        ariaLabel={`${pattern.name} diagram`}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-slate-500">
          Try it
        </span>
        <button
          type="button"
          aria-pressed={healthy}
          aria-label="Service healthy"
          onClick={(e) => {
            e.stopPropagation();
            setHealthy(true);
            onSelect("service");
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
            healthy
              ? "text-slate-950 ring-transparent"
              : "text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white"
          }`}
          style={healthy ? { backgroundColor: color } : undefined}
        >
          Service healthy
        </button>
        <button
          type="button"
          aria-pressed={!healthy}
          aria-label="Service failing"
          onClick={(e) => {
            e.stopPropagation();
            setHealthy(false);
            onSelect("service");
          }}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-white ${
            !healthy
              ? "text-slate-950 ring-transparent"
              : "text-slate-300 ring-slate-700 hover:bg-slate-800 hover:text-white"
          }`}
          style={!healthy ? { backgroundColor: "#f87171" } : undefined}
        >
          Service failing
        </button>
        <span className="mx-1 h-5 w-px bg-slate-800" />
        <button
          type="button"
          aria-label="Send a request through the breaker"
          onClick={(e) => {
            e.stopPropagation();
            sendRequest();
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
          style={{ boxShadow: `inset 0 0 0 1px ${color}55` }}
        >
          Send request →
        </button>
      </div>
    </div>
  );
}
