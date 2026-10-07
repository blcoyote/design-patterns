import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "projection",
  name: "Projection (Materialized View)",
  category: "enterprise",
  order: 9,
  summary:
    "Fold a log of events into a query-shaped table that can be thrown away and rebuilt whenever you like.",
  intent:
    "Answer a question quickly by keeping a ready-made view of the data, built by replaying the events that happened. The log stays the source of truth. The view is derived from it, shaped for one kind of query, and can be rebuilt from the log at any time.",
  problem:
    "Orders are recorded as a log of facts: placed, cancelled. Asking 'how much has each customer ordered?' by scanning the whole log on every request gets slower with every event. Storing a running total next to the orders makes reads fast, but now the total can drift away from the facts, and a new question needs a new column and a migration of the old data.",
  solution:
    "Keep the log as the only thing you write to, and add a Projector. It reads the events that came after the position the view last reached, and applies them in order to a CustomerSummaryView: one row per customer with an order count and an amount spent. The view stores the position of the last event it applied. An event at or below that position is ignored, so a redelivery does no harm. Queries read the view and never touch the log. If the view is lost or its shape needs to change, the projector resets it and replays the log from the start.",
  analogy:
    "A bank statement is a projection of the transactions. The transactions are the truth, and the statement is a convenient summary built from them. If you lose the statement, the bank prints a new one from the records, and if you want a different layout, they can print that instead.",
  whenToUse: [
    "Reads are shaped very differently from writes, such as totals per customer or a search index, and need to be fast.",
    "The source of truth is a sequence of events or changes that can be replayed in order.",
    "You expect new questions later and want to answer them by building a new view from history rather than by migrating stored data.",
  ],
  pros: [
    "Queries are simple and fast, because the answer is already computed in the shape the caller needs.",
    "The view is disposable: lose it, change its shape or fix a bug in the projection, then rebuild it from the log.",
    "Several different views can be built from the same events without affecting each other.",
    "Storing the position with the data makes redelivered events harmless.",
  ],
  cons: [
    "The view is eventually consistent: until the projector has caught up, a query can return stale or missing data.",
    "The projector is extra code to run and monitor, and a bug in it produces wrong data until the view is rebuilt.",
    "Rebuilding replays the whole history, which takes longer as the log grows and may need snapshots or a second copy of the view to avoid downtime.",
    "Events must be applied in order, so a view fed by several parallel workers needs care to keep that order.",
  ],
  realWorld: [
    "Marten and EventStoreDB projections in event-sourced .NET systems",
    "Axon Framework event handlers that maintain query models",
    "Kafka Streams and ksqlDB tables built from a topic",
    "Database materialized views, such as PostgreSQL's REFRESH MATERIALIZED VIEW",
  ],
  related: ["outbox", "inbox", "pub-sub", "cache-aside"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "eventLog",
      label: "EventLog",
      role: "Source of truth",
      kind: "object",
      x: 110,
      y: 110,
      width: 160,
      description:
        "An append-only list of facts. Each event gets the next position number, and nothing is changed or removed. Everything else can be derived from it.",
    },
    {
      id: "projector",
      label: "Projector",
      role: "Projector",
      kind: "class",
      x: 420,
      y: 110,
      width: 170,
      description:
        "Reads the events that came after the view's checkpoint and applies them, in order, to the read model. It is the only writer of the view, and it decides nothing: it replays what the log says happened. It can also reset the view and replay everything.",
    },
    {
      id: "readModel",
      label: "CustomerSummaryView",
      role: "Read model",
      kind: "object",
      x: 685,
      y: 110,
      width: 190,
      description:
        "One row per customer with an order count and the amount spent, plus the position of the last event applied. It is shaped for one question and can be deleted and rebuilt at any time.",
    },
    {
      id: "client",
      label: "Client",
      role: "Writer and reader",
      kind: "class",
      x: 420,
      y: 350,
      width: 150,
      description:
        "Appends events to the log when something happens, and asks the read model when it wants an answer. It never reads the log to answer a question.",
    },
  ],
  relations: [
    {
      id: "append",
      from: "client",
      to: "eventLog",
      type: "calls",
      label: "append",
      description:
        "Something happened, so the client records the event in the log. This is the only write, and it does not touch the read model.",
      code: "logAppend",
    },
    {
      id: "pull",
      from: "projector",
      to: "eventLog",
      type: "calls",
      label: "events after #n",
      description:
        "The projector asks for every event after the position the view has reached, and gets them back in order.",
      code: "logRead",
    },
    {
      id: "apply",
      from: "projector",
      to: "readModel",
      type: "calls",
      label: "apply",
      description:
        "The projector hands each event to the view, which updates the customer's row and moves its checkpoint. An event it has already applied is ignored.",
      code: "viewApply",
    },
    {
      id: "query",
      from: "client",
      to: "readModel",
      type: "calls",
      label: "query",
      description:
        "Reads are answered from the view alone: one lookup, already in the shape the caller needs.",
      code: "viewGet",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Writes go to the log",
      description:
        "Three orders are placed: o1 and o3 by ada, o2 by grace. Each becomes an event with the next position number. Nothing touches the read model.",
      highlight: ["client", "append", "eventLog"],
      packets: [
        { relation: "append", label: "o1 placed" },
        { relation: "append", label: "o2 placed", after: 0 },
        { relation: "append", label: "o3 placed", after: 1 },
      ],
      notes: { eventLog: "#1 #2 #3", readModel: "empty · checkpoint 0" },
      code: "logAppend",
    },
    {
      title: "The view is behind",
      description:
        "Asking about ada now finds no row yet. The log has the facts, but the projector has not applied them. This is the eventual consistency of a read model.",
      highlight: ["client", "query", "readModel"],
      packets: [
        { relation: "query", label: "ada?" },
        { relation: "query", label: "no row yet", reverse: true, after: 0 },
      ],
      code: "viewGet",
    },
    {
      title: "The projector pulls new events",
      description:
        "The projector asks the log for everything after the view's checkpoint, which is 0. It gets events #1 to #3.",
      highlight: ["projector", "pull", "eventLog"],
      packets: [
        { relation: "pull", label: "after #0" },
        { relation: "pull", label: "#1 #2 #3", reverse: true, after: 0 },
      ],
      notes: { projector: "3 pending" },
      code: "catchUp",
    },
    {
      title: "Events are folded into the view",
      description:
        "Applied in order, the events build ada's row (2 orders, 75 spent) and grace's row (1 order, 25 spent). The checkpoint moves to 3.",
      highlight: ["projector", "apply", "readModel"],
      packets: [
        { relation: "apply", label: "#1 ada +40" },
        { relation: "apply", label: "#2 grace +25", after: 0 },
        { relation: "apply", label: "#3 ada +35", after: 1 },
      ],
      notes: { readModel: "ada 2 · 75 | grace 1 · 25", projector: "checkpoint 3" },
      code: "viewApply",
    },
    {
      title: "Queries read the view",
      description:
        "The same question now returns ada's row straight away: orders=2 spent=75. The log is not consulted.",
      highlight: ["client", "query", "readModel"],
      packets: [
        { relation: "query", label: "ada?" },
        { relation: "query", label: "2 orders, 75", reverse: true, after: 0 },
      ],
      code: "viewGet",
    },
    {
      title: "A cancellation is a new event",
      description:
        "Ada cancels o1. The log never edits history, so this becomes event #4. The projector pulls it and applies it, which lowers ada's row to 1 order and 35 spent.",
      highlight: ["client", "append", "eventLog", "projector", "pull", "apply", "readModel"],
      packets: [
        { relation: "append", label: "o1 cancelled" },
        { relation: "pull", label: "after #3", after: 0 },
        { relation: "pull", label: "#4", reverse: true, after: 1 },
        { relation: "apply", label: "#4 ada −40", after: 2 },
      ],
      notes: { eventLog: "#1 #2 #3 #4", readModel: "ada 1 · 35 | grace 1 · 25" },
      code: "catchUp",
    },
    {
      title: "Applying an event twice is harmless",
      description:
        "Event #4 is delivered to the view a second time. Its position is not above the checkpoint of 4, so the view ignores it and ada's row stays at 1 order and 35 spent.",
      highlight: ["projector", "apply", "readModel"],
      packets: [{ relation: "apply", label: "#4 again" }],
      notes: { readModel: "#4 ignored" },
      code: "viewApply",
    },
    {
      title: "Rebuild from scratch",
      description:
        "The projector resets the view and replays all four events. It ends with the same rows as before: ada has 1 order and 35 spent, grace has 1 order and 25. The view was only ever a copy.",
      highlight: ["projector", "pull", "apply", "eventLog", "readModel"],
      packets: [
        { relation: "apply", label: "reset" },
        { relation: "pull", label: "after #0", after: 0 },
        { relation: "pull", label: "#1 – #4", reverse: true, after: 1 },
        { relation: "apply", label: "#1 – #4", after: 2 },
      ],
      notes: { readModel: "ada 1 · 35 | grace 1 · 25", projector: "checkpoint 4" },
      code: "rebuild",
    },
    {
      title: "The log is the truth, the view is a copy",
      description:
        "Every write went to the log, every read came from the view, and the projector kept one in step with the other. Because the view can always be rebuilt, it can be reshaped or fixed without a data migration.",
      highlight: ["eventLog", "projector", "readModel"],
      code: "projector",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
