import { Diagram } from "@/components/viz/Diagram";
import { alpha } from "@/theme/alpha";
import type { VisualizationProps } from "@/types/pattern";

/** One wait the Retrier has chosen: a share (the jitter) of the ceiling the policy allows. */
interface Wait {
  ceilingMs: number;
  delayMs: number;
}

/** What each step has decided so far, taken from the example's output (call 1, then call 2). */
// Edit together with the steps in index.ts: one entry per step, values from the example output.
const WAITS_BY_STEP: { waits: Wait[]; total?: string }[] = [
  { waits: [] },
  { waits: [{ ceilingMs: 100, delayMs: 50 }] },
  {
    waits: [
      { ceilingMs: 100, delayMs: 50 },
      { ceilingMs: 200, delayMs: 50 },
    ],
  },
  {
    waits: [
      { ceilingMs: 100, delayMs: 50 },
      { ceilingMs: 200, delayMs: 50 },
      { ceilingMs: 400, delayMs: 300 },
    ],
  },
  {
    waits: [
      { ceilingMs: 100, delayMs: 50 },
      { ceilingMs: 200, delayMs: 50 },
      { ceilingMs: 400, delayMs: 300 },
    ],
    total: "call 1 waited 400ms",
  },
  {
    waits: [
      { ceilingMs: 100, delayMs: 40 },
      { ceilingMs: 200, delayMs: 180 },
      { ceilingMs: 400, delayMs: 40 },
    ],
  },
  {
    waits: [
      { ceilingMs: 100, delayMs: 40 },
      { ceilingMs: 200, delayMs: 180 },
      { ceilingMs: 400, delayMs: 40 },
    ],
    total: "call 2 waited 260ms",
  },
  { waits: [] },
];

const PANEL_TOP = 335;
const BASELINE = 440;
const PX_PER_MS = 0.25; // a 400ms ceiling is 100 units tall

/**
 * The generic diagram plus a backoff chart under it: for each wait so far, the outline is the
 * ceiling the policy allowed and the filled part is the jittered delay actually used.
 */
export function RetryVisualization({
  pattern,
  color,
  step,
  stepIndex,
  selectedId,
  onSelect,
  speed,
}: VisualizationProps) {
  const { waits, total } = WAITS_BY_STEP[stepIndex] ?? { waits: [] };

  const overlay = (
    <g pointerEvents="none">
      <rect
        x={40}
        y={PANEL_TOP - 8}
        width={720}
        height={BASELINE - PANEL_TOP + 20}
        rx={8}
        fill="var(--color-diagram-canvas)"
        stroke="var(--color-diagram-canvas-outline)"
      />
      <text x={56} y={PANEL_TOP + 8} fontSize={11} className="fill-diagram-label-text">
        Waits: outline = ceiling, filled = jittered delay
      </text>
      {total && (
        <text
          x={744}
          y={PANEL_TOP + 8}
          fontSize={12}
          fontWeight={700}
          textAnchor="end"
          className="fill-diagram-text-active"
        >
          {total}
        </text>
      )}
      {waits.length === 0 && (
        <text
          x={400}
          y={BASELINE - 40}
          fontSize={12}
          textAnchor="middle"
          className="fill-diagram-label-text"
        >
          no wait chosen in this step
        </text>
      )}
      {waits.map((w, i) => {
        const x = 70 + i * 230;
        return (
          <g key={i}>
            <rect
              x={x}
              y={BASELINE - w.ceilingMs * PX_PER_MS}
              width={44}
              height={w.ceilingMs * PX_PER_MS}
              fill="none"
              stroke="var(--color-line-emphasis)"
              strokeDasharray="4 3"
            />
            <rect
              x={x}
              y={BASELINE - w.delayMs * PX_PER_MS}
              width={44}
              height={w.delayMs * PX_PER_MS}
              fill={alpha(color, 70)}
              stroke={color}
            />
            <text x={x + 54} y={BASELINE - 22} fontSize={12} className="fill-diagram-text">
              after attempt {i + 1}
            </text>
            <text x={x + 54} y={BASELINE - 6} fontSize={12} className="fill-diagram-text-active">
              {w.delayMs}ms of {w.ceilingMs}ms
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
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
      overlay={overlay}
      ariaLabel={`${pattern.name} diagram`}
    />
  );
}
