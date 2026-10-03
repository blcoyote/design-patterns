import { architectures } from "@/architectures/registry";
import { comparisons } from "@/comparisons/registry";
import { patterns } from "@/patterns/registry";
import type { ArchitectureDefinition } from "@/types/architecture";
import type { ComparisonDefinition } from "@/types/comparison";
import type { PatternDefinition } from "@/types/pattern";

export const SITE_NAME = "Design Patterns";

export interface SharePage {
  title: string;
  description: string;
  route: string;
  sharePath: string;
}

export const homeSeoPage: SharePage = {
  title: "Interactive Software Design Patterns and Architecture Guide",
  description:
    "Learn software design patterns and architectures through animated diagrams, runnable examples, and practical side-by-side comparisons.",
  route: "/",
  sharePath: "/share/home.html",
};

export const architectureIndexSeoPage: SharePage = {
  title: "Architectural Patterns",
  description:
    "Explore architectural patterns such as Layered, Hexagonal, DDD, CQRS, and Event Sourcing through animated diagrams and their underlying design patterns.",
  route: "/architecture",
  sharePath: "/share/architecture.html",
};

export const comparisonIndexSeoPage: SharePage = {
  title: "Design Pattern Comparisons",
  description:
    "Compare similar software design and architecture patterns side by side, see when to choose each, and test your decision with a scenario.",
  route: "/compare",
  sharePath: "/share/comparisons.html",
};

export const notFoundSeoPage: SharePage = {
  title: "Page Not Found",
  description: "The requested page could not be found.",
  route: "/__not_found__",
  sharePath: "/share/not-found.html",
};

export function patternSeoPage(
  pattern: Pick<PatternDefinition, "slug" | "name" | "intent">,
): SharePage {
  return {
    title: `${pattern.name} Design Pattern`,
    description: pattern.intent,
    route: `/patterns/${pattern.slug}`,
    sharePath: `/share/patterns/${pattern.slug}.html`,
  };
}

export function architectureSeoPage(
  architecture: Pick<ArchitectureDefinition, "slug" | "name" | "intent">,
): SharePage {
  return {
    title: `${architecture.name} Architecture Pattern`,
    description: architecture.intent,
    route: `/architecture/${architecture.slug}`,
    sharePath: `/share/architecture/${architecture.slug}.html`,
  };
}

export function comparisonSeoPage(
  comparison: Pick<ComparisonDefinition, "slug" | "title" | "summary">,
): SharePage {
  return {
    title: comparison.title,
    description: comparison.summary,
    route: `/compare/${comparison.slug}`,
    sharePath: `/share/comparisons/${comparison.slug}.html`,
  };
}

export const seoSharePages: SharePage[] = [
  homeSeoPage,
  architectureIndexSeoPage,
  comparisonIndexSeoPage,
  notFoundSeoPage,
  ...patterns.map(patternSeoPage),
  ...architectures.map(architectureSeoPage),
  ...comparisons.map(comparisonSeoPage),
];
