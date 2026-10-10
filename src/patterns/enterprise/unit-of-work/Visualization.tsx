import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Diagram } from "@/components/viz/Diagram";
import type { VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * Unit of Work keeps the generic class diagram up top (UnitOfWork holding its
 * three pending lists, with a single `flush` call reaching Database) and adds
 * a custom "pending changes" board below it: cards pile up on the UnitOfWork
 * as registerNew/registerDirty/registerRemoved are called, then flush together
 * into a BEGIN … COMMIT transaction band. A "Try it" row lets the visitor
 * replay the commit on demand — either through to COMMIT, or forced to fail
 * partway through so the whole batch rolls back and the cards return, red.
 */

type Kind = "new" | "dirty" | "removed";
type Phase = "idle" | "begin" | "flushing" | "committed" | "rolledback";

interface Card {
  id: string;
  label: string;
  kind: Kind;
}

const KIND_LABEL: Record<Kind, string> = { new: "NEW", dirty: "DIRTY", removed: "REMOVED" };
const KIND_COLOR: Record<Kind, string> = {
  new: "var(--color-ok)",
  dirty: "var(--color-warn)",
  removed: "var(--color-danger)",
};
const FAIL_COLOR = "var(--color-danger)";
const IDLE_COLOR = "var(--color-line-bold)";

const ORDER: Card = { id: "order-104", label: "Order #104", kind: "new" };
const CUSTOMER: Card = { id: "customer-58", label: "Customer #58", kind: "dirty" };
const CART: Card = { id: "cart-9", label: "Cart #9", kind: "removed" };
const ALL_CARDS = [ORDER, CUSTOMER, CART];

// The failing commit in the last step belongs to a different operation, so it
// uses different entities than the ones step 7 already committed.
const FAILED_CARDS: Card[] = [
  { id: "order-105", label: "Order #105", kind: "new" },
  { id: "customer-61", label: "Customer #61", kind: "dirty" },
  { id: "cart-12", label: "Cart #12", kind: "removed" },
];

interface Scene {
  cards: Card[];
  phase: Phase;
  failed?: boolean;
}

/** What the pending board + transaction band look like at each narrative step. */
const STEP_SCENES: Scene[] = [
  { cards: [ORDER], phase: "idle" },
  { cards: [ORDER, CUSTOMER], phase: "idle" },
  { cards: ALL_CARDS, phase: "idle" },
  { cards: ALL_CARDS, phase: "idle" },
  { cards: ALL_CARDS, phase: "begin" },
  { cards: ALL_CARDS, phase: "flushing" },
  { cards: [], phase: "committed" },
  { cards: FAILED_CARDS, phase: "rolledback", failed: true },
];

const PHASE_CAPTION: Record<Phase, string> = {
  idle: "pending",
  begin: "BEGIN",
  flushing: "INSERT / UPDATE / DELETE",
  committed: "COMMIT ✓",
  rolledback: "ROLLBACK ✗",
};

const DATABASE_CAPTION: Record<Phase, string> = {
  idle: "waiting for commit()",
  begin: "transaction open",
  flushing: "writes in flight…",
  committed: "3 writes persisted ✓",
  rolledback: "unchanged — rolled back",
};

export function UnitOfWorkVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();

  // "Try it" replays a full commit cycle on demand. Tagging the attempt with the
  // step it was fired on lets it fall back to the narrated step as soon as the
  // step player moves on — the same trick state/chain-of-responsibility use.
  const [tryRun, setTryRun] = useState<{
    forStep: number;
    outcome: "success" | "failure";
    phase: Phase;
  } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const live = tryRun && tryRun.forStep === stepIndex ? tryRun : null;
  const scene: Scene = live
    ? {
        cards: live.phase === "committed" ? [] : ALL_CARDS,
        phase: live.phase,
        failed: live.outcome === "failure" && live.phase === "rolledback",
      }
    : (STEP_SCENES[Math.min(stepIndex, STEP_SCENES.length - 1)] ?? STEP_SCENES[0]);

  function runTry(outcome: "success" | "failure") {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    onSelect("unitOfWork");
    if (reduceMotion) {
      setTryRun({
        forStep: stepIndex,
        outcome,
        phase: outcome === "success" ? "committed" : "rolledback",
      });
      return;
    }
    setTryRun({ forStep: stepIndex, outcome, phase: "begin" });
    timers.current.push(
      window.setTimeout(() => setTryRun({ forStep: stepIndex, outcome, phase: "flushing" }), 700),
    );
    timers.current.push(
      window.setTimeout(
        () =>
          setTryRun({
            forStep: stepIndex,
            outcome,
            phase: outcome === "success" ? "committed" : "rolledback",
          }),
        1600,
      ),
    );
  }

  const bandColor =
    scene.phase === "committed"
      ? color
      : scene.phase === "rolledback"
        ? FAIL_COLOR
        : scene.phase === "idle"
          ? IDLE_COLOR
          : "var(--color-warn)";

  return (
    <div>
      <Diagram
        participants={pattern.participants}
        relations={pattern.relations}
        color={color}
        viewBox={pattern.viewBox}
        highlight={step?.highlight}
        packets={step?.packets}
        notes={step?.notes}
        selectedId={selectedId}
        onSelect={onSelect}
        animationKey={stepIndex}
        packetSpeed={speed}
        ariaLabel={`${pattern.name} diagram`}
      />

      <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-[2fr_1fr_1.4fr]">
        <button
          type="button"
          className="flex min-h-28 flex-col gap-2 rounded-card bg-canvas/40 p-3 text-left ring-1 ring-control-outline outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-pressed={selectedId === "unitOfWork"}
          aria-label="UnitOfWork pending changes"
          onClick={(e) => {
            e.stopPropagation();
            onSelect("unitOfWork");
          }}
        >
          <span className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
            UnitOfWork — pending changes
          </span>
          <div className="flex min-h-8 flex-wrap items-start gap-1.5">
            <AnimatePresence mode="popLayout">
              {scene.cards.map((card) => {
                const chipColor = scene.failed ? FAIL_COLOR : KIND_COLOR[card.kind];
                return (
                  <motion.span
                    key={card.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.6, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, x: 60 }}
                    transition={
                      reduceMotion
                        ? { duration: 0.15 }
                        : { type: "spring", stiffness: 360, damping: 24 }
                    }
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-mono ring-1"
                    style={{
                      color: chipColor,
                      borderColor: chipColor,
                      boxShadow: `inset 0 0 0 1px ${alpha(chipColor, 33)}`,
                    }}
                  >
                    <span className="font-bold">{KIND_LABEL[card.kind]}</span>
                    {card.label}
                  </motion.span>
                );
              })}
            </AnimatePresence>
            {scene.cards.length === 0 && (
              <span className="text-xs text-fg-muted">— nothing pending —</span>
            )}
          </div>
        </button>

        <button
          type="button"
          className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-card bg-canvas/40 p-3 text-center ring-1 ring-control-outline outline-none transition-shadow duration-300 focus-visible:ring-2 focus-visible:ring-focus"
          aria-pressed={selectedId === "unitOfWork"}
          aria-label="Current transaction phase"
          style={{ boxShadow: `inset 0 0 0 1.5px ${bandColor}` }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect("unitOfWork");
          }}
        >
          <span className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
            Transaction
          </span>
          <span className="font-mono text-sm font-bold" style={{ color: bandColor }}>
            {PHASE_CAPTION[scene.phase]}
          </span>
        </button>

        <button
          type="button"
          className="flex min-h-28 flex-col gap-2 rounded-card bg-canvas/40 p-3 text-left ring-1 ring-control-outline outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-pressed={selectedId === "database"}
          aria-label="Database state"
          onClick={(e) => {
            e.stopPropagation();
            onSelect("database");
          }}
        >
          <span className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
            Database
          </span>
          <span className="text-sm text-fg-soft">{DATABASE_CAPTION[scene.phase]}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <span className="mr-1 text-xs font-mono uppercase tracking-wider text-fg-subtle">
          Try it
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            runTry("success");
          }}
          className="rounded-control px-3 py-1.5 text-sm font-semibold text-fg-on-accent ring-1 ring-transparent transition focus-visible:outline-2 focus-visible:outline-focus"
          style={{ backgroundColor: color }}
        >
          Commit succeeds
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            runTry("failure");
          }}
          className="rounded-control px-3 py-1.5 text-sm font-semibold text-fg-soft ring-1 ring-control-outline transition hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          Commit fails → rollback
        </button>
      </div>
    </div>
  );
}
