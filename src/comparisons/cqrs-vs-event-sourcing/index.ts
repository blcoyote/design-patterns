/**
 * CQRS and Event Sourcing are usually taught together, which makes them easy to mistake for a
 * single mandatory pair. They are not: CQRS is a statement about how many *models* you have
 * (one for writes, one for reads); Event Sourcing is a statement about how the *write side*
 * stores state (an append-only log instead of a mutable row). Every claim below was checked
 * against `src/architectures/both/cqrs` and `src/architectures/functional/event-sourcing`
 * (index.ts and all four language examples), not against the pairing in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "cqrs-vs-event-sourcing",
  title: "CQRS vs Event Sourcing",
  order: 4,
  summary:
    "Two independent choices that are often bundled: one splits read from write, the other changes what the write side stores.",
  subjects: [
    { kind: "architecture", slug: "cqrs" },
    { kind: "architecture", slug: "event-sourcing" },
  ],
  problem:
    "An order system needs to answer two questions: what is the order’s current state, and what happened to it over time? Screens need a fast view of orders; support and compliance may need a full history.",
  constraints: [
    "Do reads need a separate, denormalised shape, or would the write model answer both jobs fine?",
    'Is a full audit trail — not just the current state, but every past change — a hard requirement, or does only "what is true now" matter?',
    "Can the system tolerate reads being milliseconds (or more) behind the latest write, or must every read see the write that just happened?",
    "Is the domain naturally about things happening over time (orders, withdrawals) or about things that just exist and get overwritten (a profile field)?",
  ],
  dimensions: [
    {
      label: "What is stored as the source of truth",
      values: {
        cqrs: "A normalized write store holding current state — SqlWriteStore just upserts the current Order row. No history is kept by CQRS itself.",
        "event-sourcing":
          "An append-only log of every event that ever happened — EventStore.append() only ever adds; current state is never stored directly.",
      },
    },
    {
      label: "How reads work",
      values: {
        cqrs: "Queries go straight to a separate, denormalised ReadStore that a Projector already shaped for them — GetOrderSummaryHandler never touches the write side.",
        "event-sourcing":
          'State is computed by folding the whole stream through evolve() — fold(store.load(streamId)) in the usage code answers "what is true now" with no separate store involved.',
      },
    },
    {
      label: "Audit / history",
      values: {
        cqrs: 'Not built in: the WriteStore holds only the current Order, so "what happened and why" is not answerable from CQRS alone.',
        "event-sourcing":
          "Inherent: every AccountOpened/Deposited/Withdrawn event stays in the stream forever and can be replayed in full.",
      },
    },
    {
      label: "Consistency between what was written and what gets read back",
      values: {
        cqrs: 'Eventual in this example (and whenever the read store is updated asynchronously): a query right after dispatch can return "(none yet)" until Projector.catchUp() drains its queue into the ReadStore. A shared store or a synchronous projection would read its own writes.',
        "event-sourcing":
          "Folding the log directly (fold(store.load(streamId))) is as fresh as the last append — eventual consistency only shows up if you add a separate projection like WithdrawalCountProjection on top.",
      },
    },
    {
      label: "Complexity cost",
      values: {
        cqrs: "Two models and (often) two stores to build, deploy and keep in sync, even though the write side itself can stay a plain mutable row.",
        "event-sourcing":
          "decide/evolve are trivial to unit test, but replay cost grows with stream length without a Snapshot, and event shapes become a long-lived contract once anything depends on them.",
      },
    },
    {
      label: "What it does NOT require",
      values: {
        cqrs: "Does not require storing events at all — PlaceOrderHandler persists a plain Order, not a log of what changed about it.",
        "event-sourcing":
          "Does not require a second, denormalised read model — the example proves this by reading the balance straight off fold(), with WithdrawalCountProjection only added as an optional extra subscriber.",
      },
    },
  ],
  options: [
    {
      subject: "cqrs",
      changes:
        "PlaceOrderHandler saves the current order in SqlWriteStore. GetOrderSummaryHandler reads from InMemoryReadStore, which a Projector updates. The write store keeps only the current order, not an event history. This is CQRS without Event Sourcing.",
      chooseWhen: [
        "Read and write workloads have very different shapes or scale, and the same model is straining to serve both.",
        "The read side needs denormalised, pre-joined views that would be awkward to query from the write model directly.",
        "The write side has real invariants worth protecting behind a domain model, while most reads just need a flat projection of it.",
      ],
      code: [
        { kind: "architecture", slug: "cqrs", region: "aggregate" },
        { kind: "architecture", slug: "cqrs", region: "writeStore" },
        { kind: "architecture", slug: "cqrs", region: "readStore" },
      ],
      steps: [
        { kind: "architecture", slug: "cqrs", step: 0 },
        { kind: "architecture", slug: "cqrs", step: 6 },
      ],
    },
    {
      subject: "event-sourcing",
      changes:
        "EventStore keeps events, not a current balance row. `decide(command, state)` returns the events to save, and `fold()` applies them through `evolve()` to calculate the balance. This example reads the result directly; it has no separate read store.",
      chooseWhen: [
        "An audit trail is a hard requirement — regulators, finance or support need to know exactly what happened and when, not just the final state.",
        "The domain is naturally about things happening over time (deposits, withdrawals, orders) rather than fields that just get overwritten.",
        "Multiple, differently-shaped views will eventually be needed from the same history, and keeping a mutable table in lockstep with all of them has already caused bugs.",
      ],
      code: [
        { kind: "architecture", slug: "event-sourcing", region: "append" },
        { kind: "architecture", slug: "event-sourcing", region: "fold" },
      ],
      steps: [
        { kind: "architecture", slug: "event-sourcing", step: 0 },
        { kind: "architecture", slug: "event-sourcing", step: 2 },
      ],
    },
  ],
  noPattern: {
    when: "Reads and writes need the same data, scale, and freshness, and no one needs a full history.",
    instead:
      "Use one table and model for both reads and writes. If a query is slow, try adding an index before introducing a separate read model or an event log.",
  },
  overlap:
    "These patterns solve different problems. CQRS separates writes from reads and can use an ordinary table, as this example does. Event Sourcing stores every change as an event; you can rebuild the current state from those events without a separate read model. The two patterns can also work together: an event stream can feed a Projector that builds a read model. Using one does not require using the other.",
  scenario: {
    prompt:
      "An order system needs a fast order-history screen and an audit of why an order was cancelled. The team says, “CQRS requires Event Sourcing.” Is that true, and what should they choose?",
    choices: [
      {
        id: "both-mandatory",
        label: "Adopt both, because CQRS requires an event-sourced write side",
        verdict: "poor",
        explanation:
          "That is not true. CQRS needs separate write and read models, not an event log. This example’s write store keeps only the current order. Event Sourcing adds permanent events and replay costs, so use it only if the audit really needs that history.",
      },
      {
        id: "both-deliberate",
        label:
          "Make the write side event-sourced, and build the dashboard as a projection off its event log",
        verdict: "best",
        explanation:
          "Combining them makes sense when each solves a real need. Event Sourcing provides the audit history; a Projector turns that history into the format the dashboard needs. This is the same role WithdrawalCountProjection plays for EventStore in the example.",
      },
      {
        id: "cqrs-only",
        option: "cqrs",
        label: "CQRS alone: split read and write models, keep the write side a plain table",
        verdict: "workable",
        explanation:
          "CQRS gives the dashboard a fast read model without requiring Event Sourcing. But a plain write row has no history, so support cannot tell why an order was cancelled without a separate audit log.",
      },
      {
        id: "event-sourcing-only",
        option: "event-sourcing",
        label: "Event Sourcing alone, no separate read model",
        verdict: "workable",
        explanation:
          "Event Sourcing gives support the history it needs. Without a separate read model, however, each page must replay or snapshot a customer’s events to build the dashboard. CQRS addresses that read-model problem.",
      },
    ],
  },
};
