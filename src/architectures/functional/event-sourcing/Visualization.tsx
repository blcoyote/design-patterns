import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Diagram } from "@/components/viz/Diagram";
import { onActivate } from "@/lib/a11y";
import type { VisualizationProps } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

/**
 * Event Sourcing keeps the generic participant diagram on top (Client / decide / EventStore /
 * fold / Snapshot / Projection) and adds a literal event tape below it: a strip of immutable
 * event blocks, a "fold" cursor that sweeps across them to rebuild state, a pending event that
 * appears near decide() before it is appended, a new block that slides onto the end of the
 * tape, and a snapshot flag that lands on the tape once one has been taken.
 *
 * Layout, top to bottom: the tape (with the fold cursor above it), a row for the pending event
 * and the snapshot flag, then the folded-state and projection readouts. Every animated group sits
 * inside a plain positioned <g> and animates only its offset: motion writes its x/y/scale as a CSS
 * transform, which would otherwise replace the SVG transform attribute that positions it.
 */

const SEED_EVENTS = ['AccountOpened("Ada")', "Deposited(100)"];
const APPENDED_EVENT = "Withdrawn(30)";

const BLOCK_W = 150;
const BLOCK_H = 48;
const BLOCK_GAP = 16;
const VIEW_W = 760;
const VIEW_H = 246;
const HEADER_Y = 22;
const TAPE_Y = 100;
/** Room for the 3 events plus the "next…" slot, centred in the viewBox. */
const TAPE_START_X = (VIEW_W - (4 * BLOCK_W + 3 * BLOCK_GAP)) / 2;
const MARKER_ROW_Y = TAPE_Y + BLOCK_H / 2 + 32;
const READOUT_Y = 208;
const READOUT_W = 200;
const READOUT_H = 44;

function blockX(index: number) {
  return TAPE_START_X + index * (BLOCK_W + BLOCK_GAP) + BLOCK_W / 2;
}

/** Number of events physically on the tape at each step (0-indexed, aligned with pattern.steps). */
const TAPE_LENGTH_BY_STEP = [2, 2, 2, 2, 3, 3, 3, 3];
/** Running balance shown under the tape at each step. */
const BALANCE_BY_STEP = ["—", "—", "100", "100", "70", "70", "70", "70"];
/** Withdrawal count the projection has evolved to, at each step. */
const PROJECTION_COUNT_BY_STEP = [0, 0, 0, 0, 0, 0, 1, 1];

const REPLAY_STEP = 2;
const PENDING_STEP = 3;
const APPEND_STEP = 4;
const SNAPSHOT_STEP = 7;

export function EventSourcingVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const reduceMotion = !!useReducedMotion();
  const idx = Math.min(stepIndex, TAPE_LENGTH_BY_STEP.length - 1);

  const tapeLength = TAPE_LENGTH_BY_STEP[idx];
  const events = [...SEED_EVENTS, ...(tapeLength > SEED_EVENTS.length ? [APPENDED_EVENT] : [])];
  const balance = BALANCE_BY_STEP[idx];
  const projectionCount = PROJECTION_COUNT_BY_STEP[idx];

  const isReplaying = idx === REPLAY_STEP;
  const isPending = idx === PENDING_STEP;
  const isAppending = idx === APPEND_STEP;
  const hasSnapshot = idx >= SNAPSHOT_STEP;

  const cursorX = isReplaying ? blockX(events.length - 1) : blockX(-1);

  const select = (id: string) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect(id);
  };

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
        packetSpeed={speed}
        animationKey={stepIndex}
        ariaLabel={`${pattern.name} diagram`}
      />

      <div className="border-t border-line p-3">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full select-none rounded-card bg-canvas/40 ring-1 ring-line"
          role="group"
          aria-label={`Event tape holding ${events.length} event${events.length === 1 ? "" : "s"}, balance ${balance}`}
        >
          <text
            x={TAPE_START_X}
            y={HEADER_Y}
            className="fill-fg-subtle text-[10px] font-mono uppercase tracking-wider select-none"
          >
            EventStore stream — append-only
          </text>

          {/* The tape itself: a growing strip of immutable event blocks. */}
          <g
            role="button"
            tabIndex={0}
            aria-label="EventStore stream"
            aria-pressed={selectedId === "store"}
            className="cursor-pointer outline-none"
            onClick={select("store")}
            onKeyDown={onActivate(() => onSelect("store"))}
          >
            <AnimatePresence>
              {events.map((label, i) => {
                const isNew = i === events.length - 1 && isAppending;
                return (
                  <g key={label} transform={`translate(${blockX(i)} ${TAPE_Y})`}>
                    <motion.g
                      initial={isNew && !reduceMotion ? { x: 160, opacity: 0 } : { opacity: 1 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 220, damping: 22 }
                      }
                    >
                      <rect
                        x={-BLOCK_W / 2}
                        y={-BLOCK_H / 2}
                        width={BLOCK_W}
                        height={BLOCK_H}
                        rx={8}
                        fill={isNew ? alpha(color, 13) : "var(--color-diagram-node)"}
                        stroke={isNew ? color : "var(--color-line-bold)"}
                        strokeWidth={isNew ? 2.5 : 1.5}
                      />
                      <text
                        y={-4}
                        textAnchor="middle"
                        className="fill-fg-strong text-[11px] font-mono select-none"
                      >
                        {label}
                      </text>
                      <text
                        y={13}
                        textAnchor="middle"
                        className="fill-fg-subtle text-[9px] font-mono select-none"
                      >
                        v{i + 1}
                      </text>
                    </motion.g>
                  </g>
                );
              })}
            </AnimatePresence>

            {/* Empty slot hinting the tape keeps growing to the right. */}
            <g transform={`translate(${blockX(events.length)} ${TAPE_Y})`}>
              <rect
                x={-BLOCK_W / 2}
                y={-BLOCK_H / 2}
                width={BLOCK_W}
                height={BLOCK_H}
                rx={8}
                fill="none"
                stroke="var(--color-diagram-node-stroke)"
                strokeDasharray="4 4"
              />
              <text
                y={5}
                textAnchor="middle"
                className="fill-fg-faint text-[10px] font-mono select-none"
              >
                next…
              </text>
            </g>
          </g>

          {/* Fold cursor: sweeps left to right while replaying, parking off-tape otherwise. */}
          <motion.g
            initial={false}
            animate={{ x: cursorX, y: TAPE_Y - BLOCK_H / 2 - 18, opacity: isReplaying ? 1 : 0 }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 20 }
            }
            pointerEvents="none"
          >
            <path d="M 0 0 L -8 -11 L 8 -11 Z" fill={color} />
            <text
              y={-16}
              textAnchor="middle"
              className="fill-fg-soft text-[9px] font-mono select-none"
            >
              fold →
            </text>
          </motion.g>

          {/* Pending event: decide() has produced it, but it is not on the tape yet. */}
          <AnimatePresence>
            {isPending && (
              <g key="pending" transform={`translate(${blockX(events.length)} ${MARKER_ROW_Y})`}>
                <motion.g
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label="Pending event, not yet appended"
                  onClick={select("decide")}
                  onKeyDown={onActivate(() => onSelect("decide"))}
                >
                  <rect
                    x={-BLOCK_W / 2}
                    y={-22}
                    width={BLOCK_W}
                    height={44}
                    rx={8}
                    fill="none"
                    stroke={color}
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <text
                    y={-3}
                    textAnchor="middle"
                    className="fill-fg-soft text-[11px] font-mono select-none"
                  >
                    {APPENDED_EVENT}
                  </text>
                  <text
                    y={12}
                    textAnchor="middle"
                    className="fill-fg-subtle text-[9px] font-mono select-none"
                  >
                    pending, not appended
                  </text>
                </motion.g>
              </g>
            )}
          </AnimatePresence>

          {/* Snapshot flag, once one has been taken. */}
          <AnimatePresence>
            {hasSnapshot && (
              <g
                key="snapshot-flag"
                transform={`translate(${blockX(events.length - 1)} ${MARKER_ROW_Y})`}
              >
                <motion.g
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label="Snapshot cached at this version"
                  onClick={select("snapshot")}
                  onKeyDown={onActivate(() => onSelect("snapshot"))}
                >
                  <rect
                    x={-58}
                    y={-14}
                    width={116}
                    height={28}
                    rx={14}
                    fill={
                      selectedId === "snapshot" ? alpha(color, 20) : "var(--color-diagram-node)"
                    }
                    stroke={color}
                    strokeWidth={1.5}
                  />
                  <text
                    y={4}
                    textAnchor="middle"
                    className="text-[10px] font-bold font-mono select-none"
                    fill={color}
                  >
                    snapshot @ v{events.length}
                  </text>
                </motion.g>
              </g>
            )}
          </AnimatePresence>

          {/* Running state + projection readout. */}
          <g>
            <g
              transform={`translate(${(blockX(0) + blockX(1)) / 2} ${READOUT_Y})`}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Current balance ${balance}`}
              onClick={select("fold")}
              onKeyDown={onActivate(() => onSelect("fold"))}
            >
              <rect
                x={-READOUT_W / 2}
                y={-READOUT_H / 2}
                width={READOUT_W}
                height={READOUT_H}
                rx={8}
                fill="var(--color-diagram-node)"
                stroke={
                  isReplaying || selectedId === "fold" ? color : "var(--color-diagram-node-stroke)"
                }
                strokeWidth={isReplaying || selectedId === "fold" ? 2.5 : 1.5}
              />
              <text
                y={-4}
                textAnchor="middle"
                className="fill-fg-subtle text-[9px] font-mono uppercase tracking-wider select-none"
              >
                state (folded)
              </text>
              <text
                y={12}
                textAnchor="middle"
                className="fill-fg-strong text-[11px] font-mono select-none"
              >
                balance: {balance}
              </text>
            </g>

            <g
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Projection has seen ${projectionCount} withdrawal${projectionCount === 1 ? "" : "s"}`}
              onClick={select("projection")}
              onKeyDown={onActivate(() => onSelect("projection"))}
              transform={`translate(${(blockX(2) + blockX(3)) / 2} ${READOUT_Y})`}
            >
              <rect
                x={-READOUT_W / 2}
                y={-READOUT_H / 2}
                width={READOUT_W}
                height={READOUT_H}
                rx={8}
                fill="var(--color-diagram-node)"
                stroke={selectedId === "projection" ? color : "var(--color-diagram-node-stroke)"}
                strokeWidth={selectedId === "projection" ? 2.5 : 1.5}
              />
              <text
                y={-4}
                textAnchor="middle"
                className="fill-fg-subtle text-[9px] font-mono uppercase tracking-wider select-none"
              >
                projection
              </text>
              <text
                y={12}
                textAnchor="middle"
                className="fill-fg-strong text-[11px] font-mono select-none"
              >
                withdrawals: {projectionCount}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
