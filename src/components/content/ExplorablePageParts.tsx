import { Link } from "react-router-dom";
import { BulletList, ProsCons, Section } from "@/components/content/Section";

export function ExplorableHeader({
  label,
  kind,
  badgeClass,
  dotClass,
  name,
  intent,
}: {
  label: string;
  kind: "pattern" | "architecture";
  badgeClass: string;
  dotClass: string;
  name: string;
  intent: string;
}) {
  return (
    <header className="max-w-4xl">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ${badgeClass}`}
      >
        <span className={`size-1.5 rounded-full ${dotClass}`} />
        {label} {kind}
      </span>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg sm:text-5xl">{name}</h1>
      <p className="mt-4 text-lg leading-relaxed text-fg-soft">{intent}</p>
    </header>
  );
}

export function ExplorableSections({
  problem,
  solution,
  analogy,
  whenToUse,
  realWorld,
  pros,
  cons,
  markerClass,
}: {
  problem: string;
  solution: string;
  analogy: string;
  whenToUse: string[];
  realWorld: string[];
  pros: string[];
  cons: string[];
  markerClass: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Section title="The problem">{problem}</Section>
        <Section title="The solution">{solution}</Section>
        <Section title="Real-world analogy">{analogy}</Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title="When to use it">
          <BulletList items={whenToUse} marker="→" markerClass={markerClass} />
        </Section>
        <Section title="Seen in the wild">
          <BulletList items={realWorld} />
        </Section>
      </div>

      <ProsCons pros={pros} cons={cons} />
    </>
  );
}

export function ExplorableNavigation({
  area,
  previous,
  next,
}: {
  area: "patterns" | "architecture";
  previous?: { slug: string; name: string };
  next?: { slug: string; name: string };
}) {
  return (
    <nav
      className="flex justify-between gap-4 border-t border-line pt-6"
      aria-label={`${area === "patterns" ? "Pattern" : "Architecture"} navigation`}
    >
      {previous ? (
        <Link to={`/${area}/${previous.slug}`} className="group text-left">
          <span className="text-xs text-fg-subtle">← Previous</span>
          <span className="block font-semibold text-fg-body group-hover:text-fg">
            {previous.name}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link to={`/${area}/${next.slug}`} className="group text-right">
          <span className="text-xs text-fg-subtle">Next →</span>
          <span className="block font-semibold text-fg-body group-hover:text-fg">{next.name}</span>
        </Link>
      )}
    </nav>
  );
}
