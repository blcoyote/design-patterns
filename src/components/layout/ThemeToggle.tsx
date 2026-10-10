import { useTheme } from "@/hooks/useTheme";
import { themes, type ThemeId } from "@/theme/themes";

/** Cycles to the next theme in `themes`; the icon shows the theme a click switches to. */
export function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  const [theme, setTheme] = useTheme();
  const index = themes.findIndex((t) => t.id === theme);
  const next = themes[(index + 1) % themes.length];
  const label = `Switch to ${next.label.toLowerCase()} theme`;

  return (
    <button
      type="button"
      onClick={() => setTheme(next.id)}
      // The labelled variant shows the action as text, so the visible label is the accessible name.
      aria-label={labelled ? undefined : label}
      title={labelled ? undefined : label}
      className={
        labelled
          ? "flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-fg-muted transition hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
          : "rounded-control p-2 text-fg-muted transition hover:bg-surface-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
      }
    >
      <ThemeIcon theme={next.id} />
      {labelled && <span>{label}</span>}
    </button>
  );
}

function ThemeIcon({ theme }: { theme: ThemeId }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
