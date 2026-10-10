import { AnimatePresence, motion } from "motion/react";
import type { StepPlayer as Player } from "@/hooks/useStepPlayer";
import type { Step } from "@/types/pattern";

const SPEEDS = [0.5, 1, 2];

interface Props {
  steps: Step[];
  player: Player;
  color: string;
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 place-items-center sm:size-9 rounded-control text-fg-soft ring-1 ring-control-outline transition hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
    >
      {children}
    </button>
  );
}

export function StepPlayer({ steps, player, color }: Props) {
  const step = steps[player.index];
  if (!step) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton label="Previous step" onClick={player.prev}>
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
          </svg>
        </IconButton>
        <button
          type="button"
          onClick={player.toggle}
          aria-label={player.playing ? "Pause" : "Play"}
          className="flex h-10 items-center gap-2 sm:h-9 rounded-control px-4 text-sm font-semibold text-fg-on-accent transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-focus"
          style={{ backgroundColor: color }}
        >
          {player.playing ? (
            <svg viewBox="0 0 24 24" className="size-4 fill-current">
              <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-4 fill-current">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          {player.playing ? "Pause" : "Play"}
        </button>
        <IconButton label="Next step" onClick={player.next}>
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
          </svg>
        </IconButton>
        <IconButton label="Restart" onClick={player.reset}>
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
          </svg>
        </IconButton>

        <div
          className="ml-auto flex items-center gap-1 rounded-control p-1 ring-1 ring-control-outline"
          role="group"
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => player.setSpeed(s)}
              aria-pressed={player.speed === s}
              className={`rounded-md px-2.5 py-1.5 text-xs font-mono sm:px-2 sm:py-1 transition ${
                player.speed === s ? "bg-surface-strong text-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* progress / step dots */}
      <ol className="flex gap-1.5" aria-label="Steps">
        {steps.map((s, i) => (
          <li key={i} className="flex-1">
            <button
              type="button"
              onClick={() => {
                player.goTo(i);
                player.pause();
              }}
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === player.index ? "step" : undefined}
              className="group block w-full py-3"
            >
              <span className="relative block h-1.5 overflow-hidden rounded-full bg-surface-raised group-hover:bg-surface-strong">
                {i < player.index && (
                  <span
                    className="absolute inset-0"
                    style={{ backgroundColor: color, opacity: 0.5 }}
                  />
                )}
                {i === player.index && (
                  <motion.span
                    key={`${player.index}-${player.playing}-${player.speed}`}
                    className="absolute inset-y-0 left-0"
                    style={{ backgroundColor: color }}
                    initial={{ width: player.playing ? "0%" : "100%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: player.playing ? player.interval / 1000 : 0,
                      ease: "linear",
                    }}
                  />
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={player.index}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          aria-live="polite"
        >
          <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
            Step {player.index + 1} / {steps.length}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-fg">{step.title}</h3>
          <p className="mt-1 text-fg-soft">{step.description}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
