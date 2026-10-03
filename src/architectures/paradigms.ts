import type { Paradigm } from "@/types/architecture";

export interface ParadigmMeta {
  id: Paradigm;
  label: string;
  description: string;
  /** Hex colour used inside SVG visualisations. */
  color: string;
  /** Tailwind classes (kept as literals so Tailwind can detect them). */
  badge: string;
  dot: string;
  text: string;
}

export const paradigms: Record<Paradigm, ParadigmMeta> = {
  oo: {
    id: "oo",
    label: "Object-oriented",
    description: "Architectures built from objects, interfaces and dependency graphs.",
    color: "#fb7185",
    badge: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
    dot: "bg-rose-400",
    text: "text-rose-300",
  },
  functional: {
    id: "functional",
    label: "Functional",
    description:
      "Architectures most naturally expressed (and presented here) with pure functions, immutable data and explicit effects.",
    color: "#a3e635",
    badge: "bg-lime-400/10 text-lime-300 ring-lime-400/30",
    dot: "bg-lime-400",
    text: "text-lime-300",
  },
  both: {
    id: "both",
    label: "OO + Functional",
    description: "Architectures that mix objects and functional style, or are agnostic to either.",
    color: "#818cf8",
    badge: "bg-indigo-400/10 text-indigo-300 ring-indigo-400/30",
    dot: "bg-indigo-400",
    text: "text-indigo-300",
  },
};

export const paradigmOrder: Paradigm[] = ["oo", "functional", "both"];
