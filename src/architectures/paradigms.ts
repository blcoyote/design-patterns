import type { Paradigm } from "@/types/architecture";

export interface ParadigmMeta {
  id: Paradigm;
  label: string;
  description: string;
  /** CSS colour (a `var(--color-…)` token) used inside SVG visualisations. */
  color: string;
  /** Tailwind classes naming the same token (kept as literals so Tailwind can detect them). */
  badge: string;
  dot: string;
  text: string;
}

export const paradigms: Record<Paradigm, ParadigmMeta> = {
  oo: {
    id: "oo",
    label: "Object-oriented",
    description: "Architectures built from objects, interfaces and dependency graphs.",
    color: "var(--color-paradigm-oo)",
    badge: "bg-paradigm-oo/10 text-paradigm-oo-fg ring-paradigm-oo/30",
    dot: "bg-paradigm-oo",
    text: "text-paradigm-oo-fg",
  },
  functional: {
    id: "functional",
    label: "Functional",
    description:
      "Architectures most naturally expressed (and presented here) with pure functions, immutable data and explicit effects.",
    color: "var(--color-paradigm-functional)",
    badge: "bg-paradigm-functional/10 text-paradigm-functional-fg ring-paradigm-functional/30",
    dot: "bg-paradigm-functional",
    text: "text-paradigm-functional-fg",
  },
  both: {
    id: "both",
    label: "OO + Functional",
    description: "Architectures that mix objects and functional style, or are agnostic to either.",
    color: "var(--color-paradigm-both)",
    badge: "bg-paradigm-both/10 text-paradigm-both-fg ring-paradigm-both/30",
    dot: "bg-paradigm-both",
    text: "text-paradigm-both-fg",
  },
};

export const paradigmOrder: Paradigm[] = ["oo", "functional", "both"];
