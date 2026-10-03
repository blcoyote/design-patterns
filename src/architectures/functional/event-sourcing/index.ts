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
    'Store each change as a new event; never edit or delete earlier events. A pure `decide(command, state)` function returns the events for a command. A pure `evolve(state, event)` function applies one event to produce the next state. A thin command handler (the shell) loads the stream, replays it to rebuild the current state, calls `decide`, and appends the resulting events. Other consumers can use that same stream to create audits or read views without asking the write side for extra data. Event Sourcing itself is paradigm-neutral (object-oriented implementations put the same logic in aggregate methods); this page shows it in its functional form, the "Decider" formulation popularized by Jérémie Chassaing.',
  analogy:
    'A bank statement, not a bank balance. The branch does not keep a single number that it edits in place — it keeps every deposit and withdrawal, in order, forever. Your current balance is just "add them all up". You can also hand the same statement to an accountant (a projection), a court (an audit), or your past self (a historical replay) and each will compute something different from exactly the same facts.',
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
    "Projections are often (and asynchronous ones always) only eventually consistent with the write side, which forces every screen that reads a projection to decide how it tolerates a few milliseconds (or more) of staleness.",
    'The mental model is genuinely harder to onboard a new team onto than "there is a table, you update the row".',
  ],
  realWorld: [
    "KurrentDB (formerly EventStoreDB), Axon Framework, and Marten (Postgres) are purpose-built event-sourcing stores and frameworks",
    "Accounting and ledger systems have always worked this way — you never erase a transaction, you post a correcting one",
    'Kafka-backed "event-driven microservices" often use a topic as the append-only log and build consumer-side projections from it — though Kafka lacks per-stream reads and expected-version appends, so it is usually paired with a real event store rather than used as one',
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
        'The two pure functions at the core: decide(command, state) → events applies business rules; evolve(state, event) → state applies one fact. Together they are the entire domain model. This is the functional "Decider" formulation popularized by Jérémie Chassaing; OO implementations put the same logic in aggregate methods.',
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
        why: "A snapshot plays a Memento-like role: a captured state at a point in time, kept so a later replay can resume from it instead of starting over.",
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
        why: "An MVU runtime can keep every Model it has produced as a history list — the same idea as an event log, except each entry is already the folded state rather than the event that produced it, so time-travel is a lookup instead of a replay.",
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
      id: "handler",
      label: "handle()",
      role: "Command handler (shell)",
      kind: "object",
      x: 360,
      y: 70,
      width: 170,
      description:
        "The imperative shell around the pure core. It loads the stream, folds it into the current state, calls decide, and appends the returned events at the version it loaded. All of the I/O lives here; none of the business rules do.",
      code: "handle",
    },
    {
      id: "store",
      label: "EventStore",
      role: "Append-only store",
      kind: "class",
      x: 640,
      y: 70,
      width: 180,
      description:
        "The append-only log, keyed by stream. Enforces optimistic concurrency on every append, and notifies subscribers once the append has succeeded.",
      code: "append",
      patterns: ["pub-sub"],
    },
    {
      id: "decide",
      label: "decide()",
      role: "Decision function",
      kind: "object",
      x: 110,
      y: 230,
      width: 170,
      description:
        "Pure function decide(command, state) → Event[]. The only place business rules live: it looks at the current state and returns the events a command implies, or rejects it outright. It never touches the store.",
      code: "decide",
      patterns: ["command"],
    },
    {
      id: "fold",
      label: "fold (replay)",
      role: "Rebuild state",
      kind: "object",
      x: 360,
      y: 230,
      width: 170,
      description:
        "Reduces a stream's events through evolve, starting from an initial value, to produce the current state. Pure: it is handed the events and never reads the store itself.",
      code: "fold",
      patterns: ["iterator"],
    },
    {
      id: "snapshot",
      label: "Snapshot",
      role: "Cached fold result",
      kind: "object",
      x: 360,
      y: 380,
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
      x: 640,
      y: 330,
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
      to: "handler",
      type: "calls",
      label: "Withdraw(30)",
      description:
        "The client sends a plain command object to the command handler. It has no idea whether this will succeed, or what events (if any) it will produce.",
      code: "handle",
    },
    {
      id: "load",
      from: "handler",
      to: "store",
      type: "calls",
      label: "load(stream)",
      description:
        'The handler reads every event recorded for this stream so far. No separate "current balance" is stored anywhere for it to read instead.',
      bend: -30,
      code: "handle",
    },
    {
      id: "replay",
      from: "handler",
      to: "fold",
      type: "calls",
      label: "fold(events)",
      description:
        "The handler replays the loaded events through evolve to rebuild the current state — the only way to get it.",
      code: "fold",
    },
    {
      id: "decideCall",
      from: "handler",
      to: "decide",
      type: "calls",
      label: "decide(cmd, state)",
      description:
        "The handler passes the command and the rebuilt state to the pure decide function, which returns the events to append (or rejects the command).",
      code: "decide",
    },
    {
      id: "append",
      from: "handler",
      to: "store",
      type: "calls",
      label: "append(v2, [Withdrawn(30)])",
      description:
        "The handler appends the new events at the version it loaded. If another writer appended in the meantime, the append is rejected.",
      bend: 30,
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
      from: "fold",
      to: "snapshot",
      type: "creates",
      label: "snapshot(v3, state)",
      description:
        "Periodically, an already-folded state is cached together with its version, so the next read does not have to replay from event zero.",
      code: "snapshot",
    },
  ],

  steps: [
    {
      title: "An append-only tape of events",
      description:
        'EventStore holds every stream as a sequence of immutable, past-tense events. There is no "current row" anywhere — decide and evolve are the entire domain model, fold is the only way state comes into being, and a thin command handler does all the I/O around them.',
      highlight: ["client", "handler", "decide", "store", "fold", "snapshot", "projection"],
      code: "evolve",
    },
    {
      title: "Client sends a command",
      description:
        "The client does not touch the event store directly — it sends a plain command, Withdraw(30), to the command handler and waits.",
      highlight: ["client", "command", "handler"],
      packets: [{ relation: "command", label: "Withdraw(30)" }],
      notes: { handler: "command received" },
      code: "handle",
    },
    {
      title: "Rebuilding current state by folding the stream",
      description:
        "Before anything can be decided, the handler needs the account's current state. It loads every event appended so far and folds them through evolve, one event at a time — the fold cursor sweeps the tape from the start.",
      highlight: ["handler", "load", "store", "replay", "fold"],
      packets: [
        { relation: "load", label: "load(stream)" },
        { relation: "load", label: "2 events", reverse: true, after: 0 },
        { relation: "replay", label: "fold(events)", after: 1 },
      ],
      notes: { fold: "balance 0 → 100" },
      code: "fold",
    },
    {
      title: "decide checks the invariant",
      description:
        "With state = { balance: 100 } in hand, the handler calls decide(Withdraw(30), state). decide checks the withdrawal against the balance and returns a Withdrawn(30) event. It never touches the store itself — only the event comes back out.",
      highlight: ["handler", "decideCall", "decide"],
      packets: [
        { relation: "decideCall", label: "decide(cmd, state)" },
        { relation: "decideCall", label: "[Withdrawn(30)]", reverse: true, after: 0 },
      ],
      notes: { decide: "returns Withdrawn(30)" },
      code: "decide",
    },
    {
      title: "EventStore appends the new event",
      description:
        "The handler appends the event at version 2, the version of the history it loaded. The append succeeds because the stream is still at version 2 — optimistic concurrency would reject it if another writer had appended in the meantime.",
      highlight: ["handler", "append", "store"],
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
      highlight: ["fold", "cache", "snapshot"],
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
