import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { UsedBadge } from "@/components/content/UsedInThisSite";

export function ExplorableCard({
  to,
  accentColor,
  label,
  labelClass,
  used,
  name,
  summary,
  footer,
  index,
}: {
  to: string;
  accentColor: string;
  label: string;
  labelClass: string;
  used: boolean;
  name: string;
  summary: string;
  footer: ReactNode;
  index: number;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        to={to}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-slate-900/50 p-5 ring-1 ring-slate-800 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:ring-slate-600"
      >
        <span
          className="absolute -top-16 -right-16 size-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30"
          style={{ backgroundColor: accentColor }}
          aria-hidden
        />
        <span className="flex items-center gap-2">
          <span className={labelClass}>{label}</span>
          {used && <UsedBadge />}
        </span>
        <span className="mt-1 text-xl font-semibold text-white">{name}</span>
        <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{summary}</span>
        <span className="mt-4 flex items-center gap-3 font-mono text-xs text-slate-500">
          {footer}
          <span className="ml-auto text-slate-400 transition group-hover:translate-x-1 group-hover:text-white">
            →
          </span>
        </span>
      </Link>
    </motion.li>
  );
}
