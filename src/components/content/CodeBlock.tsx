import { Highlight, themes } from 'prism-react-renderer'
import { useEffect, useRef, useState } from 'react'

interface Props {
  code: string
  /** Inclusive 1-based line range to highlight. */
  highlight?: [number, number]
  color: string
  className?: string
}

export function CodeBlock({ code, highlight, color, className = '' }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [from, to] = highlight ?? [0, -1]

  useEffect(() => {
    const el = scroller.current
    if (!el || from < 1) return
    const line = el.querySelector<HTMLElement>(`[data-line="${from}"]`)
    if (line) el.scrollTo({ top: Math.max(0, line.offsetTop - 24), behavior: 'smooth' })
  }, [from, to])

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#011627] ring-1 ring-slate-800 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
        <span className="font-mono">example.ts</span>
        <button type="button" onClick={copy} className="rounded px-2 py-0.5 hover:bg-slate-800 hover:text-white">
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      <div ref={scroller} className="relative max-h-[30rem] overflow-auto py-3">
        <Highlight code={code} language="tsx" theme={themes.nightOwl}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="min-w-max text-[13px] leading-6">
              {tokens.map((line, i) => {
                const n = i + 1
                const on = n >= from && n <= to
                const { className: lineClass, ...lineProps } = getLineProps({ line })
                return (
                  <div
                    key={i}
                    data-line={n}
                    {...lineProps}
                    className={`${lineClass} flex border-l-2 pr-6 transition-[background-color,opacity] duration-300 ${
                      highlight && !on ? 'opacity-45' : ''
                    }`}
                    style={{
                      borderColor: on ? color : 'transparent',
                      backgroundColor: on ? `${color}1f` : undefined,
                    }}
                  >
                    <span className="w-10 shrink-0 pr-4 text-right text-slate-600 select-none">{n}</span>
                    <span>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                )
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  )
}
