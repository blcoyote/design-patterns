import type { ComparisonDefinition } from "@/types/comparison";
import { Panel, PanelHeading } from "./Section";

type Verdict = ComparisonDefinition["scenario"]["choices"][number]["verdict"];

const VERDICT_LABEL: Record<Verdict, string> = {
  best: "Best fit",
  workable: "Workable",
  poor: "Poor fit",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  best: "bg-ok/10 text-ok-fg ring-ok/30",
  workable: "bg-warn/10 text-warn-fg ring-warn/30",
  poor: "bg-negative/10 text-negative-fg ring-negative/30",
};

/**
 * A "which should I choose?" quiz: the reader picks a choice and sees its verdict and
 * explanation; picking any one reveals all of them, so the reader can compare. Controlled by the
 * parent (`ComparisonPage`) — nothing is persisted, but the parent uses the pick to preselect the
 * ADR export's chosen option when it maps to a subject.
 */
export function ScenarioQuiz({
  scenario,
  picked,
  onPick,
}: {
  scenario: ComparisonDefinition["scenario"];
  picked: string | null;
  onPick: (id: string) => void;
}) {
  const revealAll = picked !== null;
  const pickedChoice = scenario.choices.find((c) => c.id === picked);

  return (
    <Panel className="p-6">
      <PanelHeading>Which should you choose?</PanelHeading>
      <p className="mt-3 text-lg leading-relaxed text-fg-body">{scenario.prompt}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Choices">
        {scenario.choices.map((choice) => {
          const show = revealAll || choice.id === picked;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === picked}
              onClick={() => onPick(choice.id)}
              className={`rounded-card p-4 text-left ring-1 transition ${
                choice.id === picked
                  ? "bg-surface ring-line-emphasis"
                  : "ring-line hover:bg-surface hover:ring-line-bold"
              }`}
            >
              <span className="block font-semibold text-fg">{choice.label}</span>
              {show && (
                <>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${VERDICT_STYLE[choice.verdict]}`}
                  >
                    {VERDICT_LABEL[choice.verdict]}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-fg-muted">
                    {choice.explanation}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {pickedChoice
          ? `${pickedChoice.label}: ${VERDICT_LABEL[pickedChoice.verdict]}. ${pickedChoice.explanation}`
          : ""}
      </p>
    </Panel>
  );
}
