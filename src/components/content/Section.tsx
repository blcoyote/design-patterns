import type { ReactNode } from "react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-surface/40 ring-1 ring-line ${className}`}>
      {children}
    </section>
  );
}

export function PanelHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">{children}</h2>
  );
}

export function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={`p-4 sm:p-6 ${className}`}>
      <PanelHeading>{title}</PanelHeading>
      <div className="mt-3 leading-relaxed wrap-anywhere text-fg-soft">{children}</div>
    </Panel>
  );
}

export function BulletList({
  items,
  marker = "•",
  markerClass = "text-fg-subtle",
}: {
  items: string[];
  marker?: string;
  markerClass?: string;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className={`shrink-0 font-mono ${markerClass}`} aria-hidden>
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Pros">
        <BulletList items={pros} marker="+" markerClass="text-ok" />
      </Section>
      <Section title="Cons">
        <BulletList items={cons} marker="−" markerClass="text-negative" />
      </Section>
    </div>
  );
}
