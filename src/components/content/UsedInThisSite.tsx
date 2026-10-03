import { CodeBlock } from './CodeBlock'
import type { SelfUsage } from '@/lib/selfUsage'

interface Props {
  usages: SelfUsage[]
}

/**
 * Proof the pattern isn't just theory: every place this site's own code tags itself with
 * `// @pattern <slug>: …` (see `vite-plugins/patternUsages.ts`) shows up here, linked to the
 * exact line on GitHub. Box style mirrors `CrossReferenceBox` (ring/tint deliberately different,
 * same reasoning as there — this should read as its own kind of box, not just another `Section`).
 */
export function UsedInThisSite({ usages }: Props) {
  if (usages.length === 0) return null

  return (
    <section className="rounded-2xl bg-slate-900/60 p-6 ring-1 ring-inset ring-emerald-500/20">
      <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-emerald-300 uppercase">
        <UsedIcon className="size-3.5" />
        Used in this site
      </h2>
      <ul className="mt-4 space-y-5">
        {usages.map((usage) => (
          <li key={`${usage.file}:${usage.line}`}>
            <a href={usage.githubUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-emerald-300 hover:underline">
              {usage.file}:{usage.line}
            </a>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{usage.explanation}</p>
            <CodeBlock
              className="mt-2"
              sources={[{ lang: 'typescript', text: usage.snippet, fileName: usage.file.split('/').pop() }]}
              active="typescript"
              onActiveChange={() => {}}
              color="#34d399"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

function UsedIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} aria-hidden>
      <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6z" />
    </svg>
  )
}

/**
 * Small "used here" badge for home/architecture cards and sidebar entries. Icon + `aria-label`
 * so the status isn't conveyed by colour alone.
 */
export function UsedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Used in this site"
      title="Used in this site"
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300 ${className}`}
    >
      <UsedIcon className="size-2.5" />
    </span>
  )
}
