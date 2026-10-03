import type { ComparisonDefinition } from '@/types/comparison'

type Verdict = ComparisonDefinition['scenario']['choices'][number]['verdict']

const VERDICT_LABEL: Record<Verdict, string> = {
  best: 'Best fit',
  workable: 'Workable',
  poor: 'Poor fit',
}

const VERDICT_STYLE: Record<Verdict, string> = {
  best: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
  workable: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
  poor: 'bg-rose-400/10 text-rose-300 ring-rose-400/30',
}

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
  scenario: ComparisonDefinition['scenario']
  picked: string | null
  onPick: (id: string) => void
}) {
  const revealAll = picked !== null
  const pickedChoice = scenario.choices.find((c) => c.id === picked)

  return (
    <section className="rounded-2xl bg-slate-900/40 p-6 ring-1 ring-slate-800">
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Which should you choose?</h2>
      <p className="mt-3 text-lg leading-relaxed text-slate-200">{scenario.prompt}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Choices">
        {scenario.choices.map((choice) => {
          const show = revealAll || choice.id === picked
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === picked}
              onClick={() => onPick(choice.id)}
              className={`rounded-xl p-4 text-left ring-1 transition ${
                choice.id === picked ? 'bg-slate-900 ring-slate-500' : 'ring-slate-800 hover:bg-slate-900/60 hover:ring-slate-600'
              }`}
            >
              <span className="block font-semibold text-white">{choice.label}</span>
              {show && (
                <>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${VERDICT_STYLE[choice.verdict]}`}
                  >
                    {VERDICT_LABEL[choice.verdict]}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-slate-400">{choice.explanation}</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {pickedChoice ? `${pickedChoice.label}: ${VERDICT_LABEL[pickedChoice.verdict]}. ${pickedChoice.explanation}` : ''}
      </p>
    </section>
  )
}
