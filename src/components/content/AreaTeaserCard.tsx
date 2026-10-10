import { Link } from "react-router-dom";

const ACCENT_CLASS = {
  architecture: "bg-paradigm-both/10",
  comparison: "bg-compare/10",
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
      className={`group flex items-center justify-between gap-4 rounded-card ${ACCENT_CLASS[variant]} p-5 shadow-card ring-1 ring-card-outline transition hover:shadow-raised hover:ring-line-bold`}
    >
      <div>
        <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle">{eyebrow}</p>
        <p className="mt-1 text-lg font-semibold text-fg">
          {title} <span className="text-fg-soft">{highlight}</span>
        </p>
        <p className="mt-1 text-sm text-fg-muted">{description}</p>
      </div>
      <span className="shrink-0 text-2xl text-fg-subtle transition group-hover:translate-x-1 group-hover:text-fg">
        →
      </span>
    </Link>
  );
}
