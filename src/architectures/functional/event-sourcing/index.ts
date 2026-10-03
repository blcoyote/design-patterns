import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { EventSourcingVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "event-sourcing",
  name: "Event Sourcing",
  paradigm: "functional",
  order: 5,
  summary:
    "Keep a log of every change and rebuild current state from it instead of overwriting it.",
  intent:
    "Store each change as an event in a log that can only grow. Rebuild the current state by replaying those events. The same history can support audits and different read views.",
  problem:
    "When an app saves only the latest value, it loses the changes that led there. A separate audit table can fall out of sync with the data it is meant to explain. Building another view, such as a dashboard or search index, may then require repeatedly scraping the current table.",
  solution:
    "Store each change as a new event; never edit or delete earlier events. A pure `decide(command, state)` function returns the events for a command. A pure `evolve(state, event)` function applies one event to produce the next state. Replay the event stream to rebuild the current state. Other consumers can use that same stream to create audits or read views without asking the write side for extra data.",
  analogy:
    'A bank statement, not a bank balance. The branch does not keep a single number that it edits in place — it keeps every deposit and withdrawal, in order, forever. Your current balance is just "add them all up". You can also hand the same statement to an accountant (a projection), a court (an audit), or your past self (a historical replay) and each will compute something different from identically the same facts.',
  whenToUse: [
    "An audit trail is a hard requirement, not a nice-to-have — regulators, finance, or support need to know exactly what happened and when, not just the final state.",
    "The domain is naturally about things happening over time (orders, bookings, ledgers) rather than things merely existing (a user's profile fields).",
    "Multiple, differently-shaped read models need to be built from the same underlying history, and keeping them in lockstep with a mutable table has already caused bugs.",
    'Temporal queries matter: "what was true as of last Tuesday" needs an actual answer, not a guess from a change log nobody trusts.',
  ],
  pros: [
    "Nothing is ever lost: every past decision is preserved exactly as it happened, which makes debugging production issues dramatically easier — you can literally replay what the user did.",
    "New read models are cheap to add later: point a new projection at the existing stream from the beginning (or from a snapshot) instead of migrating a live table.",
    "decide and evolve are pure functions with no I/O, so the actual business logic is trivial to unit test with plain values and no database.",
    'Optimistic concurrency falls out naturally: an append only succeeds if the stream is still at the version the writer last read, which is a precise way to detect "someone else changed this first".',
  ],
  cons: [
    "Reading current state is no longer a simple row lookup — without snapshots, rebuilding a long-lived stream means replaying everything that ever happened to it.",
    'Events are a permanent, public contract: changing their shape later means writing "upcasters" to translate old events forward, not just running a schema migration.',
    "Projections are only eventually consistent with the write side, which forces every screen that reads a projection to decide how it tolerates a few milliseconds (or more) of staleness.",
    'The mental model is genuinely harder to onboard a new team onto than "there is a table, you update the row".',
  ],
  realWorld: [
    "EventStoreDB, Axon Framework, and Marten (Postgres) are purpose-built event-sourcing stores and frameworks",
    "Git itself is an event-sourced system: commits are immutable events, and `git checkout` is a fold over them",
    "Accounting and ledger systems have always worked this way — you never erase a transaction, you post a correcting one",
    'Kafka-backed "event-driven microservices" often use a topic as the append-only log and build consumer-side projections from it',
  ],
  concepts: [
    {
      term: "Event",
      description:
        'An immutable fact about something that already happened — "Withdrawn", not "Withdraw". Past tense, never edited once appended.',
    },
    {
      term: "Stream",
      description:
        "The ordered sequence of events belonging to one entity (one bank account, one order). The unit an append-only store is keyed by.",
    },
    {
      term: "Append-only store",
      description:
        "A log you can only add to, never update or delete from. The EventStore in this scenario; conceptually the same idea as a commit log.",
    },
    {
      term: "decide / evolve",
      description:
        "The two pure functions at the core: decide(command, state) → events applies business rules; evolve(state, event) → state applies one fact. Together they are the entire domain model.",
    },
    {
      term: "Replay / fold",
      description:
        "Rebuilding current state by reducing the whole stream through evolve, starting from an initial value. There is no other way state comes into existence.",
    },
    {
      term: "Snapshot",
      description:
        "A cached fold result at a known stream version, so a later read can fold only the events appended after it instead of starting from zero.",
    },
    {
      term: "Projection",
      description:
        "A read model built by subscribing to the stream and evolving its own shape — independent of, and usually differently shaped from, the write-side state.",
    },
    {
      term: "Optimistic concurrency (expected version)",
      description:
        "An append states the version it expects the stream to be at; the store rejects it if another writer already moved the stream past that point.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "memento",
        why: "A snapshot is exactly a Memento: an opaque capture of state at a point in time, created so a later replay can resume from it instead of starting over.",
      },
      {
        slug: "command",
        why: 'Every write enters as a command object — "Withdraw(30)" — that decide() interprets, which is the Command pattern\'s "encapsulate a request as an object" applied to the write side.',
      },
      {
        slug: "pub-sub",
        why: "The event store publishes each appended event to whichever subscribers care, without knowing who they are — the same broker-style decoupling Pub/Sub provides.",
      },
      {
        slug: "observer",
        why: "A projection is an Observer: it reacts to events as they are appended and updates its own state, without the store needing to know what any particular projection does with them.",
      },
      {
        slug: "iterator",
        why: "Replaying a stream to rebuild state walks it one event at a time through a uniform interface, exactly what Iterator abstracts over any collection.",
      },
      {
        slug: "state",
        why: "evolve(state, event) is state transition made explicit and total — the account's behavior at any moment is entirely determined by which events it has already folded.",
      },
    ],
    architectures: [
      {
        slug: "ddd",
        why: "A DDD aggregate's history is a natural event stream: the domain events it already raises to express what happened are exactly what Event Sourcing appends and replays.",
      },
      {
        slug: "cqrs",
        why: "The event store is the write side's single source of truth; CQRS read-side projections are just subscribers to the same stream Event Sourcing already produces.",
      },
      {
        slug: "functional-core",
        why: "decide and evolve are already pure, effect-free functions over plain data — the shell's entire job is loading events in and appending events out around that pure core.",
      },
      {
        slug: "event-driven",
        why: "Integration events published on a broker (OrderPlaced, StockReserved) are transient messages consumed and forgotten; Event Sourcing's events are the permanent source of truth state is rebuilt from — easy to confuse, genuinely different jobs.",
      },
      {
        slug: "mvu",
        why: "An MVU runtime keeps every Model it has produced as a history list — the same idea as an event log, except each entry is already the folded state rather than the event that produced it, so time-travel is a lookup instead of a replay.",
      },
    ],
  },

  viewBox: "0 0 800 460",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 90,
      y: 70,
      description:
        'Sends a plain command — "Withdraw(30)" — and never touches the event store, the fold, or any state directly.',
    },
    {
      id: "decide",
      label: "decide()",
      role: "Decision function",
      kind: "object",
      x: 340,
      y: 70,
      width: 170,
      description:
        "Pure function decide(command, state) → Event[]. The only place business rules live: it looks at the current state and returns the events a command implies, or rejects it outright.",
      code: "decide",
      patterns: ["command"],
    },
    {
      id: "store",
      label: "EventStore",
      role: "Append-only store",
      kind: "class",
      x: 620,
      y: 70,
      width: 180,
      description:
        "The append-only log, keyed by stream. Enforces optimistic concurrency on every append, and notifies subscribers once an event is durably written.",
      code: "append",
      patterns: ["pub-sub"],
    },
    {
      id: "fold",
      label: "fold (replay)",
      role: "Rebuild state",
      kind: "object",
      x: 340,
      y: 210,
      width: 170,
      description:
        "Loads a stream's events and reduces them through evolve, starting from an initial value, to produce the current state. There is no other way state exists.",
      code: "fold",
      patterns: ["iterator", "state"],
    },
    {
      id: "snapshot",
      label: "Snapshot",
      role: "Cached fold result",
      kind: "object",
      x: 620,
      y: 210,
      width: 170,
      description:
        "A cached (version, state) pair. A later read folds only the events appended after this version instead of replaying the whole stream from zero.",
      code: "snapshot",
      patterns: ["memento"],
    },
    {
      id: "projection",
      label: "Projection",
      role: "Read model",
      kind: "class",
      x: 620,
      y: 350,
      width: 180,
      description:
        "Subscribes to appended events and evolves its own, independently-shaped read model — here, a running count of withdrawals — without ever calling back into the store.",
      code: "projection",
      patterns: ["observer"],
    },
  ],
  relations: [
    {
      id: "command",
      from: "client",
      to: "decide",
      type: "calls",
      label: "Withdraw(30)",
      description:
        "The client sends a plain command object. It has no idea whether this will succeed, or what events (if any) it will produce.",
      code: "decide",
    },
    {
      id: "replay",
      from: "decide",
      to: "fold",
      type: "calls",
      label: "replay()",
      description:
        "Before deciding anything, decide needs the entity's current state — and the only way to get it is to replay its history.",
      code: "fold",
    },
    {
      id: "load",
      from: "fold",
      to: "store",
      type: "calls",
      label: "load(stream)",
      description:
        'fold reads every event recorded for this stream so far. No separate "current balance" is stored anywhere for it to read instead.',
      code: "fold",
    },
    {
      id: "append",
      from: "decide",
      to: "store",
      type: "calls",
      label: "append(v2, [Withdrawn(30)])",
      description:
        "Once decide produces an event, it is appended at the version the reader last saw. If another writer got there first, the append is rejected.",
      code: "append",
    },
    {
      id: "publish",
      from: "store",
      to: "projection",
      type: "notifies",
      label: "notify(Withdrawn(30))",
      description:
        "The store tells its subscribers about the newly appended event. The projection never polls the store — it waits to be told.",
      code: "append",
    },
    {
      id: "cache",
      from: "store",
      to: "snapshot",
      type: "creates",
      label: "snapshot(v3, state)",
      description:
        "Periodically, the already-folded state is cached at its version, so the next read does not have to replay from event zero.",
      code: "snapshot",
    },
  ],

  steps: [
    {
      title: "An append-only tape of events",
      description:
        'EventStore holds every stream as a sequence of immutable, past-tense events. There is no "current row" anywhere — decide and evolve are the entire domain model, and fold is the only way state comes into being.',
      highlight: ["client", "decide", "store", "fold", "snapshot", "projection"],
      code: "evolve",
    },
    {
      title: "Client sends a command",
      description:
        "The client does not touch the event store directly — it sends a plain command, Withdraw(30), to the decision function and waits.",
      highlight: ["client", "command", "decide"],
      packets: [{ relation: "command", label: "Withdraw(30)" }],
      notes: { decide: "command received" },
      code: "decide",
    },
    {
      title: "Rebuilding current state by folding the stream",
      description:
        "Before it can decide anything, decide needs the account's current state. fold loads every event appended so far and replays it through evolve, one event at a time — the fold cursor sweeps the tape from the start.",
      highlight: ["decide", "replay", "fold", "load", "store"],
      packets: [
        { relation: "replay", label: "replay()" },
        { relation: "load", label: "load(stream)", after: 0 },
      ],
      notes: { fold: "balance 0 → 100" },
      code: "fold",
    },
    {
      title: "decide checks the invariant",
      description:
        "With state = { balance: 100 } in hand, decide(Withdraw(30), state) checks the withdrawal against the balance and returns a Withdrawn(30) event. It never touches the store itself — only the event comes back out.",
      highlight: ["decide"],
      notes: { decide: "returns Withdrawn(30)" },
      code: "decide",
    },
    {
      title: "EventStore appends the new event",
      description:
        "decide hands its event to the store. The append only succeeds because the stream is still at version 2, the version decide read it at — optimistic concurrency catches any writer that raced in ahead of it.",
      highlight: ["decide", "append", "store"],
      packets: [{ relation: "append", label: "append(v2, [Withdrawn(30)])" }],
      notes: { store: "v2 → v3" },
      code: "append",
    },
    {
      title: "The appended event is published",
      description:
        "Once the write succeeds, EventStore notifies its subscribers. Projection is one of them, and it only ever reacts — it never calls into the store to ask for anything.",
      highlight: ["store", "publish", "projection"],
      packets: [{ relation: "publish", label: "notify(Withdrawn(30))" }],
      code: "append",
    },
    {
      title: "Projection evolves its own read model",
      description:
        "Projection keeps a tiny piece of state of its own — a running withdrawal count — evolved independently of the write-side Account. It is just another fold, one event at a time.",
      highlight: ["projection"],
      notes: { projection: "withdrawals: 1" },
      code: "projection",
    },
    {
      title: "A snapshot skips the replay",
      description:
        "Replaying every event on every read does not scale forever. A Snapshot caches the folded state at a known version, so the next read folds only the events appended after v3 instead of starting from event zero.",
      highlight: ["store", "cache", "snapshot"],
      packets: [{ relation: "cache", label: "snapshot(v3, state)" }],
      notes: { snapshot: "cached @ v3" },
      code: "snapshot",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: EventSourcingVisualization,
};
