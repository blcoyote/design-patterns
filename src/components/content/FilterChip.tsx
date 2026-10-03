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
          ? "bg-slate-800 text-white ring-slate-600"
          : "text-slate-400 ring-slate-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
