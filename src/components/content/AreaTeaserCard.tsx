import { Link } from "react-router-dom";

const ACCENT_CLASS = {
  architecture: "bg-linear-to-r from-paradigm-oo/10 via-paradigm-both/10 to-paradigm-functional/10",
  comparison: "bg-linear-to-r from-compare/10 via-fg-subtle/10 to-fg-subtle/10",
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
      className={`group flex items-center justify-between gap-4 rounded-2xl ${ACCENT_CLASS[variant]} p-5 ring-1 ring-line transition hover:ring-line-bold`}
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
