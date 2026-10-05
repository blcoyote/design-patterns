import type { Category } from "@/types/pattern";

export interface CategoryMeta {
  id: Category;
  label: string;
  description: string;
  /** CSS colour (a `var(--color-…)` token) used inside SVG visualisations. */
  color: string;
  /** Tailwind classes naming the same token (kept as literals so Tailwind can detect them). */
  badge: string;
  dot: string;
  text: string;
}

export const categories: Record<Category, CategoryMeta> = {
  creational: {
    id: "creational",
    label: "Creational",
    description: "How objects get created — hiding construction details and controlling instances.",
    color: "var(--color-cat-creational)",
    badge: "bg-cat-creational/10 text-cat-creational-fg ring-cat-creational/30",
    dot: "bg-cat-creational",
    text: "text-cat-creational-fg",
  },
  structural: {
    id: "structural",
    label: "Structural",
    description: "How objects and classes are composed into larger structures.",
    color: "var(--color-cat-structural)",
    badge: "bg-cat-structural/10 text-cat-structural-fg ring-cat-structural/30",
    dot: "bg-cat-structural",
    text: "text-cat-structural-fg",
  },
  behavioral: {
    id: "behavioral",
    label: "Behavioral",
    description: "How objects communicate and share responsibilities.",
    color: "var(--color-cat-behavioral)",
    badge: "bg-cat-behavioral/10 text-cat-behavioral-fg ring-cat-behavioral/30",
    dot: "bg-cat-behavioral",
    text: "text-cat-behavioral-fg",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    description:
      "Patterns beyond the GoF catalogue, drawn from enterprise and cloud architecture literature (Fowler, Nygard, Hohpe & Woolf, …): data access, resilience, wiring, messaging and resource reuse.",
    color: "var(--color-cat-enterprise)",
    badge: "bg-cat-enterprise/10 text-cat-enterprise-fg ring-cat-enterprise/30",
    dot: "bg-cat-enterprise",
    text: "text-cat-enterprise-fg",
  },
};

export const categoryOrder: Category[] = ["creational", "structural", "behavioral", "enterprise"];
