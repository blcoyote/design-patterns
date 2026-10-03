import type { ReactNode } from 'react'

export function Section({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl bg-slate-900/40 p-4 ring-1 sm:p-6 ring-slate-800 ${className}`}>
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{title}</h2>
      <div className="mt-3 leading-relaxed [overflow-wrap:anywhere] text-slate-300">{children}</div>
    </section>
  )
}

export function BulletList({ items, marker = '•', markerClass = 'text-slate-500' }: { items: string[]; marker?: string; markerClass?: string }) {
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
  )
}

export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Section title="Pros">
        <BulletList items={pros} marker="+" markerClass="text-emerald-400" />
      </Section>
      <Section title="Cons">
        <BulletList items={cons} marker="−" markerClass="text-rose-400" />
      </Section>
    </div>
  )
}
