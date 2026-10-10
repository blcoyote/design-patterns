import { AnimatePresence, motion } from "motion/react";
import { onActivate } from "@/lib/a11y";
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/geometry";
import type { Participant } from "@/types/pattern";
import { alpha } from "@/theme/alpha";

const STEREOTYPE: Partial<Record<NonNullable<Participant["kind"]>, string>> = {
  interface: "«interface»",
  abstract: "«abstract»",
  client: "«client»",
  object: "«object»",
};

export interface DiagramNodeProps {
  participant: Participant;
  color: string;
  active: boolean;
  dimmed: boolean;
  selected: boolean;
  note?: string;
  /** Place the note badge above the node instead of below. */
  noteAbove?: boolean;
  onSelect: (id: string) => void;
}

export function DiagramNode({
  participant: p,
  color,
  active,
  dimmed,
  selected,
  note,
  noteAbove,
  onSelect,
}: DiagramNodeProps) {
  const w = p.width ?? NODE_WIDTH;
  const h = NODE_HEIGHT;
  const stereotype = p.kind ? STEREOTYPE[p.kind] : undefined;
  const isAbstract = p.kind === "interface" || p.kind === "abstract";
  const select = () => onSelect(p.id);

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${p.label} — ${p.role}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none [&:focus-visible>rect.frame]:stroke-focus"
      onClick={(e) => {
        e.stopPropagation();
        select();
      }}
      onKeyDown={onActivate(select)}
      initial={false}
      animate={{ opacity: dimmed ? 0.35 : 1, x: p.x, y: p.y }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.04 }}
    >
      {active && (
        <motion.rect
          x={-w / 2 - 6}
          y={-h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={16}
          fill="none"
          stroke={color}
          strokeWidth={2}
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: [0.7, 0, 0.7], scale: [1, 1.06, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ filter: "var(--diagram-glow)" }}
        />
      )}
      <rect
        className="frame transition-colors duration-300"
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={12}
        fill={active ? alpha(color, 13) : "var(--color-diagram-node)"}
        stroke={
          selected ? "var(--color-selected)" : active ? color : "var(--color-diagram-node-stroke)"
        }
        strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={isAbstract ? "6 4" : undefined}
      />
      {stereotype && (
        <text
          y={-h / 2 + 15}
          textAnchor="middle"
          className="fill-fg-muted text-[10px] font-mono select-none"
        >
          {stereotype}
        </text>
      )}
      <text
        y={stereotype ? 6 : -2}
        textAnchor="middle"
        className={`text-[14px] font-semibold select-none ${isAbstract ? "italic" : ""}`}
        fill={active || selected ? "var(--color-diagram-text-active)" : "var(--color-diagram-text)"}
      >
        {p.label}
      </text>
      <text
        y={stereotype ? 22 : 16}
        textAnchor="middle"
        className="fill-fg-muted text-[11px] select-none"
      >
        {p.role}
      </text>

      <AnimatePresence>
        {note && (
          <motion.g
            key={note}
            initial={{ opacity: 0, y: noteAbove ? -h / 2 - 8 : h / 2 + 8, scale: 0.6 }}
            animate={{ opacity: 1, y: noteAbove ? -h / 2 - 18 : h / 2 + 18, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <rect
              x={-(note.length * 3.6 + 12)}
              y={-10}
              width={note.length * 7.2 + 24}
              height={20}
              rx={10}
              fill={color}
            />
            <text
              y={4}
              textAnchor="middle"
              className="fill-fg-on-accent text-[11px] font-semibold font-mono select-none"
            >
              {note}
            </text>
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  );
}
