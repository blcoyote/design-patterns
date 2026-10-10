import { useEffect, useMemo, useRef, useState } from "react";
import { adrFilename, buildAdr, NO_PATTERN, type AdrSubject } from "@/lib/adr";
import type { ComparisonDefinition } from "@/types/comparison";
import { Panel, PanelHeading } from "./Section";

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Exports the comparison, plus a chosen option, as a MADR-style architecture decision record —
 * so a team that worked through the comparison can drop the outcome straight into their own
 * project's `docs/decisions/`. Preselects the subject the scenario quiz picked, when that pick
 * maps onto one of the subjects (a "no pattern" or purely illustrative quiz choice does not).
 */
export function AdrExport({
  comparison,
  subjects,
  preselected,
}: {
  comparison: ComparisonDefinition;
  subjects: AdrSubject[];
  /** A subject slug to preselect, typically the scenario quiz's pick when it names a subject. */
  preselected?: string;
}) {
  const [chosen, setChosen] = useState(preselected ?? subjects[0]?.slug ?? NO_PATTERN);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  // The quiz pick (if any) only arrives after this component has already mounted with a default
  // selection — apply it the first time it shows up, but never fight a choice the reader then
  // makes by hand.
  const appliedPreselect = useRef(false);
  useEffect(() => {
    if (preselected && !appliedPreselect.current) {
      appliedPreselect.current = true;
      setChosen(preselected);
    }
  }, [preselected]);

  const adr = useMemo(() => {
    const sourceUrl = `${location.origin}${location.pathname}#/compare/${comparison.slug}`;
    return buildAdr({ comparison, chosen, subjects, date: today(), sourceUrl });
  }, [comparison, chosen, subjects]);

  const filename = adrFilename(chosen, subjects);

  const copy = async () => {
    await navigator.clipboard.writeText(adr);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([adr], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel className="p-6">
      <PanelHeading>Export as an ADR</PanelHeading>
      <p className="mt-3 leading-relaxed text-fg-soft">
        Turn this comparison into an architecture decision record (MADR format, with YAML
        frontmatter) for your own project's <code className="text-fg-muted">docs/decisions/</code>.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium tracking-wider text-fg-subtle uppercase">
          Chosen option
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chosen option">
          {subjects.map((s) => (
            <label
              key={s.slug}
              className={`flex cursor-pointer items-center gap-2 rounded-control px-3 py-1.5 text-sm ring-1 transition focus-within:outline-2 focus-within:outline-focus ${
                chosen === s.slug
                  ? "bg-surface-raised text-fg ring-fg-muted"
                  : "text-fg-muted ring-control-outline hover:text-fg"
              }`}
            >
              <input
                type="radio"
                name="adr-chosen"
                value={s.slug}
                checked={chosen === s.slug}
                onChange={() => setChosen(s.slug)}
                className="sr-only"
              />
              {s.name}
            </label>
          ))}
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-control px-3 py-1.5 text-sm ring-1 transition focus-within:outline-2 focus-within:outline-focus ${
              chosen === NO_PATTERN
                ? "bg-surface-raised text-fg ring-fg-muted"
                : "text-fg-muted ring-control-outline hover:text-fg"
            }`}
          >
            <input
              type="radio"
              name="adr-chosen"
              value={NO_PATTERN}
              checked={chosen === NO_PATTERN}
              onChange={() => setChosen(NO_PATTERN)}
              className="sr-only"
            />
            No pattern
          </label>
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="rounded-control px-3 py-1.5 text-sm font-medium text-fg-body ring-1 ring-control-outline hover:bg-surface"
        >
          {open ? "Hide preview" : "Show preview"}
        </button>
        <button
          type="button"
          onClick={copy}
          className="rounded-control px-3 py-1.5 text-sm font-medium text-fg-body ring-1 ring-control-outline hover:bg-surface"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          className="rounded-control bg-inverse px-3 py-1.5 text-sm font-semibold text-on-inverse hover:bg-inverse-hover"
        >
          Download {filename}
        </button>
      </div>

      {open && (
        <pre className="mt-4 max-h-128 overflow-auto rounded-card bg-code-bg p-4 text-xs leading-relaxed whitespace-pre-wrap text-fg-soft ring-1 ring-card-outline">
          {adr}
        </pre>
      )}
    </Panel>
  );
}
