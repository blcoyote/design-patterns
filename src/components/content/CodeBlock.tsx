import { Highlight } from "prism-react-renderer";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import "@/lib/prism";
import type { CodeLanguage } from "@/hooks/useCodeLanguage";
import { codeTheme } from "@/theme/codeTheme";
import { alpha } from "@/theme/alpha";

export interface CodeSource {
  lang: CodeLanguage;
  text: string;
  /** Inclusive 1-based line range to highlight. */
  highlight?: [number, number];
  /** Header label; defaults to the example file name for `lang`. */
  fileName?: string;
}

interface Props {
  sources: CodeSource[];
  /** Which source is shown. Falls back to the first source if not present. */
  active: CodeLanguage;
  onActiveChange: (lang: CodeLanguage) => void;
  color: string;
  className?: string;
}

const FILE_NAME: Record<CodeLanguage, string> = {
  typescript: "example.ts",
  csharp: "Example.cs",
  python: "example.py",
  go: "example.go",
};

const PRISM_LANGUAGE: Record<CodeLanguage, string> = {
  typescript: "tsx",
  csharp: "csharp",
  python: "python",
  go: "go",
};

export function CodeBlock({ sources, active, onActiveChange, color, className = "" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<CodeLanguage, HTMLButtonElement | null>>>({});
  const [copied, setCopied] = useState(false);
  const uid = useId();

  const current = sources.find((s) => s.lang === active) ?? sources[0];
  const [from, to] = current.highlight ?? [0, -1];
  const tabId = (lang: CodeLanguage) => `code-tab-${uid}-${lang}`;
  const panelId = `code-panel-${uid}`;

  useEffect(() => {
    const el = scroller.current;
    if (!el || from < 1) return;
    const line = el.querySelector<HTMLElement>(`[data-line="${from}"]`);
    if (line)
      el.scrollTo({
        top: Math.max(0, line.offsetTop - 24),
        behavior: "smooth",
      });
  }, [from, to, current.lang]);

  const copy = async () => {
    await navigator.clipboard.writeText(current.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (sources.length < 2) return;
    const i = sources.findIndex((s) => s.lang === current.lang);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % sources.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + sources.length) % sources.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = sources.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const lang = sources[next].lang;
    onActiveChange(lang);
    tabRefs.current[lang]?.focus();
  };

  return (
    <div className={`relative overflow-hidden rounded-xl bg-code-bg ring-1 ring-line ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 text-xs text-fg-muted sm:px-4">
        {sources.length > 1 ? (
          <div
            role="tablist"
            aria-label="Code language"
            className="flex min-w-0 gap-2 overflow-x-auto sm:gap-3"
            onKeyDown={onTabKeyDown}
          >
            {sources.map((s) => {
              const selected = s.lang === current.lang;
              return (
                <button
                  key={s.lang}
                  ref={(el) => {
                    tabRefs.current[s.lang] = el;
                  }}
                  role="tab"
                  type="button"
                  id={tabId(s.lang)}
                  aria-selected={selected}
                  aria-controls={panelId}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onActiveChange(s.lang)}
                  className="shrink-0 rounded px-1 pb-1 font-mono transition-colors"
                  style={{
                    color: selected ? color : undefined,
                    boxShadow: selected ? `inset 0 -2px 0 0 ${color}` : undefined,
                  }}
                >
                  {s.fileName ?? FILE_NAME[s.lang]}
                </button>
              );
            })}
          </div>
        ) : (
          <span id={tabId(current.lang)} className="font-mono">
            {current.fileName ?? FILE_NAME[current.lang]}
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded px-2 py-1 hover:bg-surface-raised hover:text-fg"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <div
        ref={scroller}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(current.lang)}
        className="relative max-h-120 overflow-auto py-3"
      >
        <Highlight code={current.text} language={PRISM_LANGUAGE[current.lang]} theme={codeTheme}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="min-w-max text-[13px] leading-6">
              {tokens.map((line, i) => {
                const n = i + 1;
                const on = n >= from && n <= to;
                const { className: lineClass, ...lineProps } = getLineProps({
                  line,
                });
                return (
                  <div
                    key={i}
                    data-line={n}
                    {...lineProps}
                    className={`${lineClass} flex border-l-2 pr-6 transition-[background-color,opacity] duration-300 ${
                      current.highlight && !on ? "opacity-45" : ""
                    }`}
                    style={{
                      borderColor: on ? color : "transparent",
                      backgroundColor: on ? alpha(color, 12) : undefined,
                    }}
                  >
                    <span className="w-10 shrink-0 pr-4 text-right text-fg-faint select-none">
                      {n}
                    </span>
                    <span>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  );
}
