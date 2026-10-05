import type { ReactNode } from "react";

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm ring-1 transition ${
        active
          ? "bg-surface-raised text-fg ring-line-bold"
          : "text-fg-muted ring-line hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
