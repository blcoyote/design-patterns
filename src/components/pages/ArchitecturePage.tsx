import { useParams, useSearchParams } from "react-router-dom";
import { ComparisonTeaser } from "@/components/content/ComparisonTeaser";
import { CrossReferenceBox } from "@/components/content/CrossReferenceBox";
import {
  ExplorableHeader,
  ExplorableNavigation,
  ExplorableSections,
} from "@/components/content/ExplorablePageParts";
import { Seo } from "@/components/content/Seo";
import { Section } from "@/components/content/Section";
import { UsedInThisSite } from "@/components/content/UsedInThisSite";
import { PatternExplorer } from "@/components/viz/PatternExplorer";
import { paradigms } from "@/architectures/paradigms";
import {
  architectureNeighbours,
  getArchitecture,
} from "@/architectures/registry";
import { comparisonsFor } from "@/comparisons/registry";
import { architecturesUsedBy, designPatternsUsedBy } from "@/lib/crossRefs";
import { usagesOf } from "@/lib/selfUsage";
import { parseStepParam } from "@/lib/stepParam";
import { architectureSeoPage } from "@/lib/seoPages";
import { NotFound } from "./NotFound";

/** Mirrors PatternPage, with the paradigm badge/colour instead of category, a cross-reference box
 * linking back to the design patterns this architecture is built from, and a concepts glossary. */
export function ArchitecturePage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const architecture = getArchitecture(slug);
  if (!architecture) return <NotFound />;

  const meta = paradigms[architecture.paradigm];
  const { prev, next } = architectureNeighbours(architecture.slug);
  const designPatterns = designPatternsUsedBy(architecture);
  const siblingArchitectures = architecturesUsedBy(architecture);
  const usages = usagesOf(architecture.slug);
  const comparisons = comparisonsFor(architecture.slug);
  const initialStep = parseStepParam(
    searchParams.get("step"),
    architecture.steps.length,
  );

  return (
    <article className="space-y-8">
      <Seo page={architectureSeoPage(architecture)} />
      <ExplorableHeader
        label={meta.label}
        kind="architecture"
        badgeClass={meta.badge}
        dotClass={meta.dot}
        name={architecture.name}
        intent={architecture.intent}
      />

      <PatternExplorer
        key={`${architecture.slug}:${initialStep ?? "auto"}`}
        pattern={architecture}
        color={meta.color}
        initialStep={initialStep}
      />

      <CrossReferenceBox
        title={`Commonly used with ${architecture.name}`}
        designPatterns={designPatterns}
        architectures={siblingArchitectures}
      />

      <ComparisonTeaser comparisons={comparisons} />

      <UsedInThisSite usages={usages} />

      <ExplorableSections
        problem={architecture.problem}
        solution={architecture.solution}
        analogy={architecture.analogy}
        whenToUse={architecture.whenToUse}
        realWorld={architecture.realWorld}
        pros={architecture.pros}
        cons={architecture.cons}
        markerClass={meta.text}
      />

      <Section title="Key concepts">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {architecture.concepts.map((c) => (
            <div key={c.term}>
              <dt className="font-semibold text-white">{c.term}</dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-slate-400">
                {c.description}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {architecture.variants && architecture.variants.length > 0 && (
        <Section title="Variants">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {architecture.variants.map((v) => (
              <div key={v.name}>
                <dt className="font-semibold text-white">{v.name}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-slate-400">
                  {v.description}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <ExplorableNavigation area="architecture" previous={prev} next={next} />
    </article>
  );
}
