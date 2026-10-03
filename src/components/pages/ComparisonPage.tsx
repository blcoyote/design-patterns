import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AdrExport } from "@/components/content/AdrExport";
import { CodeBlock } from "@/components/content/CodeBlock";
import { Seo } from "@/components/content/Seo";
import { ScenarioQuiz } from "@/components/content/ScenarioQuiz";
import { BulletList, Panel, Section } from "@/components/content/Section";
import { getComparison } from "@/comparisons/registry";
import { useCodeLanguage } from "@/hooks/useCodeLanguage";
import type { AdrSubject } from "@/lib/adr";
import { buildCodeSources, parseLanguages } from "@/lib/codeLanguages";
import { resolveSubject, type ResolvedSubject } from "@/lib/crossRefs";
import type { ArchitectureDefinition } from "@/types/architecture";
import type { PatternDefinition } from "@/types/pattern";
import { NotFound } from "./NotFound";

/** The "which should I choose?" page for one comparison: problem/constraints, a dimensions
 * table, one card per subject with inline code and step links, a "no pattern" note, an overlap
 * note, a scenario quiz, and an ADR export. Mirrors PatternPage/ArchitecturePage's section rhythm. */
export function ComparisonPage() {
  const { slug } = useParams();
  const [activeLang, setActiveLang] = useCodeLanguage();
  const [picked, setPicked] = useState<string | null>(null);
  const comparison = getComparison(slug);
  if (!comparison) return <NotFound />;

  const subjects = comparison.subjects
    .map((ref) => resolveSubject(ref))
    .filter((s): s is ResolvedSubject => s !== undefined);
  const subjectBySlug = new Map(subjects.map((s) => [s.slug, s]));
  // Both PatternDefinition and ArchitectureDefinition add pros/cons to the shared ExplorableDefinition
  // (see src/types/{pattern,architecture}.ts) — ResolvedSubject only types `def` as the shared base.
  const adrSubjects: AdrSubject[] = subjects.map((s) => {
    const def = s.def as PatternDefinition | ArchitectureDefinition;
    return {
      slug: s.slug,
      name: s.name,
      href: s.href,
      pros: def.pros,
      cons: def.cons,
    };
  });
  // A quiz answer preselects the ADR export only when it declares which option it stands for.
  const preselected = comparison.scenario.choices.find(
    (c) => c.id === picked,
  )?.option;

  return (
    <article className="space-y-8">
      <Seo title={comparison.title} description={comparison.summary} />
      <header className="max-w-4xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
          Which should I choose?
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {comparison.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-300">
          {comparison.summary}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {subjects.map((s) => (
            <Link
              key={s.slug}
              to={s.href}
              className="rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-slate-700 transition hover:ring-slate-500"
              style={{ color: s.color }}
            >
              {s.name}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="The problem">{comparison.problem}</Section>
        <Section title="What decides between them">
          <BulletList items={comparison.constraints} marker="→" />
        </Section>
      </div>

      <Section title="Side by side" className="overflow-x-auto">
        <table className="w-full min-w-lg border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="p-2 text-left font-medium text-slate-500"
                scope="col"
              />
              {subjects.map((s) => (
                <th
                  key={s.slug}
                  className="p-2 text-left font-semibold"
                  style={{ color: s.color }}
                  scope="col"
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.dimensions.map((dim) => (
              <tr key={dim.label} className="border-t border-slate-800">
                <th
                  className="p-2 text-left align-top font-medium text-slate-400"
                  scope="row"
                >
                  {dim.label}
                </th>
                {subjects.map((s) => (
                  <td key={s.slug} className="p-2 align-top text-slate-300">
                    {dim.values[s.slug]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {comparison.options.map((option) => {
          const subject = subjectBySlug.get(option.subject);
          if (!subject) return null;
          return (
            <Panel key={option.subject} className="space-y-4 p-6">
              <h2
                className="text-xl font-semibold"
                style={{ color: subject.color }}
              >
                {subject.name}
              </h2>
              <p className="leading-relaxed text-slate-300">{option.changes}</p>
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                  Choose it when
                </p>
                <div className="mt-2">
                  <BulletList
                    items={option.chooseWhen}
                    marker="→"
                    markerClass="text-slate-500"
                  />
                </div>
              </div>

              {option.code.map((ref) => {
                const resolved = subjectBySlug.get(ref.slug);
                if (!resolved) return null;
                const sources = buildCodeSources(
                  parseLanguages(resolved.def),
                  ref.region,
                );
                return (
                  <CodeBlock
                    key={`${ref.slug}-${ref.region}`}
                    sources={sources}
                    active={activeLang}
                    onActiveChange={setActiveLang}
                    color={resolved.color}
                  />
                );
              })}

              {option.steps.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {option.steps.map((ref) => {
                    const resolved = subjectBySlug.get(ref.slug);
                    const title = resolved?.def.steps[ref.step]?.title;
                    if (!resolved || !title) return null;
                    return (
                      <Link
                        key={`${ref.slug}-${ref.step}`}
                        to={`${resolved.href}?step=${ref.step}`}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-slate-700 transition hover:ring-slate-500"
                        style={{ color: resolved.color }}
                      >
                        See it animated: {title} →
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      <Section title="When you need no pattern at all">
        <p>
          <span className="font-semibold text-slate-200">
            {comparison.noPattern.when}
          </span>{" "}
          {comparison.noPattern.instead}
        </p>
      </Section>

      {comparison.overlap && (
        <Section title="Where they overlap">{comparison.overlap}</Section>
      )}

      <ScenarioQuiz
        scenario={comparison.scenario}
        picked={picked}
        onPick={setPicked}
      />

      <AdrExport
        comparison={comparison}
        subjects={adrSubjects}
        preselected={preselected}
      />
    </article>
  );
}
