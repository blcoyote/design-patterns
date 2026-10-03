/**
 * CQRS and Event Sourcing are usually taught together, which makes them easy to mistake for a
 * single mandatory pair. They are not: CQRS is a statement about how many *models* you have
 * (one for writes, one for reads); Event Sourcing is a statement about how the *write side*
 * stores state (an append-only log instead of a mutable row). Every claim below was checked
 * against `src/architectures/both/cqrs` and `src/architectures/functional/event-sourcing`
 * (index.ts and all four language examples), not against the pairing in the abstract.
 */
import type { ComparisonDefinition } from '@/types/comparison'

export const comparison: ComparisonDefinition = {
  slug: 'cqrs-vs-event-sourcing',
  title: 'CQRS vs Event Sourcing',
  order: 4,
  summary: 'Two independent choices that are often bundled: one splits read from write, the other changes what the write side stores.',
  subjects: [
    { kind: 'architecture', slug: 'cqrs' },
    { kind: 'architecture', slug: 'event-sourcing' },
  ],
  problem:
    'An order-processing system needs to answer two unrelated questions well: screens and reports need a fast, pre-shaped view of orders (a customer\'s order history, a dashboard), and support or compliance needs to know exactly what happened to a given order and when, not just its final state.',
  constraints: [
    'Does the write side need a separate, denormalised shape for reads, or would the same model answer both jobs fine?',
    'Is a full audit trail — not just the current state, but every past change — a hard requirement, or does only "what is true now" matter?',
    'Can the system tolerate reads being milliseconds (or more) behind the latest write, or must every read see the write that just happened?',
    'Is the domain naturally about things happening over time (orders, withdrawals) or about things that just exist and get overwritten (a profile field)?',
  ],
  dimensions: [
    {
      label: 'What is stored as the source of truth',
      values: {
        cqrs: 'A normalized write store holding current state — SqlWriteStore just upserts the current Order row. No history is kept by CQRS itself.',
        'event-sourcing': 'An append-only log of every event that ever happened — EventStore.append() only ever adds; current state is never stored directly.',
      },
    },
    {
      label: 'How reads work',
      values: {
        cqrs: 'Queries go straight to a separate, denormalised ReadStore that a Projector already shaped for them — GetOrderSummaryHandler never touches the write side.',
        'event-sourcing': 'State is computed by folding the whole stream through evolve() — fold(store.load(streamId)) in the usage code answers "what is true now" with no separate store involved.',
      },
    },
    {
      label: 'Audit / history',
      values: {
        cqrs: 'Not built in: the WriteStore holds only the current Order, so "what happened and why" is not answerable from CQRS alone.',
        'event-sourcing': 'Inherent: every AccountOpened/Deposited/Withdrawn event stays in the stream forever and can be replayed in full.',
      },
    },
    {
      label: 'Consistency between what was written and what gets read back',
      values: {
        cqrs: 'Explicitly eventual: a query right after dispatch can return "(none yet)" until Projector.catchUp() drains its queue into the ReadStore.',
        'event-sourcing': 'Folding the log directly (fold(store.load(streamId))) is as fresh as the last append — eventual consistency only shows up if you add a separate projection like WithdrawalCountProjection on top.',
      },
    },
    {
      label: 'Complexity cost',
      values: {
        cqrs: 'Two models and (often) two stores to build, deploy and keep in sync, even though the write side itself can stay a plain mutable row.',
        'event-sourcing': 'decide/evolve are trivial to unit test, but replay cost grows with stream length without a Snapshot, and event shapes become a long-lived contract once anything depends on them.',
      },
    },
    {
      label: 'What it does NOT require',
      values: {
        cqrs: 'Does not require storing events at all — PlaceOrderHandler persists a plain Order, not a log of what changed about it.',
        'event-sourcing': 'Does not require a second, denormalised read model — the example proves this by reading the balance straight off fold(), with WithdrawalCountProjection only added as an optional extra subscriber.',
      },
    },
  ],
  options: [
    {
      subject: 'cqrs',
      changes:
        'Order handling splits into two independent paths: PlaceOrderHandler builds the Order aggregate and saves it to SqlWriteStore (a plain upsert of the current row), while GetOrderSummaryHandler answers queries only from InMemoryReadStore, kept up to date by a Projector that reshapes whatever the write side last persisted. Nothing here is append-only — the write side stores current state, just like a plain CRUD table would.',
      chooseWhen: [
        'Read and write workloads have very different shapes or scale, and the same model is straining to serve both.',
        'The read side needs denormalised, pre-joined views that would be awkward to query from the write model directly.',
        'The write side has real invariants worth protecting behind a domain model, while most reads just need a flat projection of it.',
      ],
      code: [
        { kind: 'architecture', slug: 'cqrs', region: 'aggregate' },
        { kind: 'architecture', slug: 'cqrs', region: 'writeStore' },
        { kind: 'architecture', slug: 'cqrs', region: 'readStore' },
      ],
      steps: [
        { kind: 'architecture', slug: 'cqrs', step: 0 },
        { kind: 'architecture', slug: 'cqrs', step: 6 },
      ],
    },
    {
      subject: 'event-sourcing',
      changes:
        'Account handling never stores a current balance row at all. decide(command, state) returns the events a command implies, EventStore.append() is the only write operation, and the balance is computed by fold()-ing the whole stream through evolve(). The usage code reads "balance:" straight off fold(store.load(streamId)) — no separate read store sits in between.',
      chooseWhen: [
        'An audit trail is a hard requirement — regulators, finance or support need to know exactly what happened and when, not just the final state.',
        'The domain is naturally about things happening over time (deposits, withdrawals, orders) rather than fields that just get overwritten.',
        'Multiple, differently-shaped views will eventually be needed from the same history, and keeping a mutable table in lockstep with all of them has already caused bugs.',
      ],
      code: [
        { kind: 'architecture', slug: 'event-sourcing', region: 'append' },
        { kind: 'architecture', slug: 'event-sourcing', region: 'fold' },
      ],
      steps: [
        { kind: 'architecture', slug: 'event-sourcing', step: 0 },
        { kind: 'architecture', slug: 'event-sourcing', step: 2 },
      ],
    },
  ],
  noPattern: {
    when: 'Reads and writes are the same shape, scale and freshness requirement, and nobody has a provable need to reconstruct history.',
    instead:
      'A single normalized table, read and written by the same model — add an index for the slow query before reaching for either CQRS\'s second model or Event Sourcing\'s append-only log.',
  },
  overlap:
    'CQRS and Event Sourcing are often taught as a pair, but neither requires the other. CQRS is only about splitting the write model from the read model — this example\'s SqlWriteStore is a plain mutable row, no event in sight, and a Projector can reshape "current state" into a read view just as well whether that write side is a CRUD table or an event-sourced aggregate. Event Sourcing is only about how the write side stores state, and it can be read without any second model at all: fold(store.load(streamId)) answers "what is true now" directly, with no ReadStore and no Projector required. They do combine well — an event log is already the sequence of changes a projection needs, so WithdrawalCountProjection subscribing to EventStore here is the same shape a CQRS read side would take off an event-sourced write side. But "we use CQRS" says nothing about whether the write side is event-sourced, and "we are event-sourced" says nothing about whether a separate read model exists.',
  scenario: {
    prompt:
      'An order system needs a fast, denormalised "order history" screen per customer, and support needs to know exactly what happened to a cancelled order and why. The team proposes adopting both patterns, reasoning that "CQRS requires Event Sourcing to work." Evaluate that reasoning and the options.',
    choices: [
      {
        id: 'both-mandatory',
        label: 'Adopt both, because CQRS requires an event-sourced write side',
        verdict: 'poor',
        explanation:
          'The premise is false: CQRS only needs a write model and a read model, not an event log — this example\'s write side (SqlWriteStore) is a plain upserted row, nothing append-only about it. Treating the pairing as mandatory forces the team into Event Sourcing\'s permanent event contracts and replay cost before anyone has established that the audit requirement actually needs them.',
      },
      {
        id: 'both-deliberate',
        label: 'Make the write side event-sourced, and build the dashboard as a projection off its event log',
        verdict: 'best',
        explanation:
          'This is where combining genuinely pays off, but as a deliberate choice, not an automatic consequence of using either one. The audit requirement justifies the event log as the source of truth (decide/evolve/append), and the dashboard\'s need for a different shape is exactly what a projection already is — the same relationship WithdrawalCountProjection has to EventStore in the example, just reused for order history instead of a withdrawal count.',
      },
      {
        id: 'cqrs-only',
        option: 'cqrs',
        label: 'CQRS alone: split read and write models, keep the write side a plain table',
        verdict: 'workable',
        explanation:
          'Solves the dashboard\'s need for a fast, denormalised view without taking on Event Sourcing\'s permanent event contracts — a Projector can reshape SqlWriteStore\'s current row into InMemoryReadStore just as it does here. But the write side still has no history, so support still cannot answer "what happened and why" without a separate audit log bolted on.',
      },
      {
        id: 'event-sourcing-only',
        option: 'event-sourcing',
        label: 'Event Sourcing alone, no separate read model',
        verdict: 'workable',
        explanation:
          'Gives support exactly what it needs — replaying the stream answers what happened to a cancelled order and when. But the dashboard then has to fold (or snapshot) each customer\'s stream itself for every page view, which is the read-shape problem CQRS exists to solve.',
      },
    ],
  },
}
