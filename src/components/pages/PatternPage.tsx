import { Link, useParams, useSearchParams } from "react-router-dom";
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
import { comparisonsFor } from "@/comparisons/registry";
import { architecturesUsing } from "@/lib/crossRefs";
import { usagesOf } from "@/lib/selfUsage";
import { parseStepParam } from "@/lib/stepParam";
import { patternSeoPage } from "@/lib/seoPages";
import { categories } from "@/patterns/categories";
import { getPattern, neighbours } from "@/patterns/registry";
import { NotFound } from "./NotFound";

export function PatternPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const pattern = getPattern(slug);
  if (!pattern) return <NotFound />;

  const cat = categories[pattern.category];
  const { prev, next } = neighbours(pattern.slug);
  const related = pattern.related.map(getPattern).filter((p) => p !== undefined);
  const usedByArchitectures = architecturesUsing(pattern.slug);
  const usages = usagesOf(pattern.slug);
  const comparisons = comparisonsFor(pattern.slug);
  const initialStep = parseStepParam(searchParams.get("step"), pattern.steps.length);

  return (
    <article className="space-y-8">
      <Seo page={patternSeoPage(pattern)} />
      <ExplorableHeader
        label={cat.label}
        kind="pattern"
        badgeClass={cat.badge}
        dotClass={cat.dot}
        name={pattern.name}
        intent={pattern.intent}
      />

      <PatternExplorer
        key={`${pattern.slug}:${initialStep ?? "auto"}`}
        pattern={pattern}
        color={cat.color}
        initialStep={initialStep}
      />

      <ExplorableSections
        problem={pattern.problem}
        solution={pattern.solution}
        analogy={pattern.analogy}
        whenToUse={pattern.whenToUse}
        realWorld={pattern.realWorld}
        pros={pattern.pros}
        cons={pattern.cons}
        markerClass={cat.text}
      />

      {usedByArchitectures.length > 0 && (
        <CrossReferenceBox
          title={`Architectural patterns that commonly use ${pattern.name}`}
          architectures={usedByArchitectures}
        />
      )}

      <ComparisonTeaser comparisons={comparisons} />

      <UsedInThisSite usages={usages} />

      {related.length > 0 && (
        <Section title="Related patterns">
          <div className="flex flex-wrap gap-3">
            {related.map((r) => (
              <Link
                key={r.slug}
                to={`/patterns/${r.slug}`}
                className="group rounded-xl px-4 py-3 ring-1 ring-slate-800 transition hover:bg-slate-900 hover:ring-slate-600"
              >
                <span className={`text-xs ${categories[r.category].text}`}>
                  {categories[r.category].label}
                </span>
                <span className="block font-semibold text-white">{r.name}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <ExplorableNavigation area="patterns" previous={prev} next={next} />
    </article>
  );
}
