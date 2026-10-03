import { Link } from "react-router-dom";

const ACCENT_CLASS = {
  architecture: "bg-linear-to-r from-rose-500/10 via-indigo-500/10 to-lime-500/10",
  comparison: "bg-linear-to-r from-amber-500/10 via-slate-500/10 to-slate-500/10",
} as const;

export function AreaTeaserCard({
  to,
  variant,
  eyebrow,
  title,
  highlight,
  description,
}: {
  to: string;
  variant: keyof typeof ACCENT_CLASS;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-center justify-between gap-4 rounded-2xl ${ACCENT_CLASS[variant]} p-5 ring-1 ring-slate-800 transition hover:ring-slate-600`}
    >
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500">{eyebrow}</p>
        <p className="mt-1 text-lg font-semibold text-white">
          {title} <span className="text-slate-300">{highlight}</span>
        </p>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <span className="shrink-0 text-2xl text-slate-500 transition group-hover:translate-x-1 group-hover:text-white">
        →
      </span>
    </Link>
  );
}
