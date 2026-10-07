import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { CqrsVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "cqrs",
  name: "CQRS",
  paradigm: "both",
  order: 4,
  summary: "Split writes and reads into separate models, each optimized for what it actually does.",
  intent:
    "Command Query Responsibility Segregation (CQRS) separates the model that changes data from the model that answers questions. Each side can be designed, scaled, and stored for its own job.",
  problem:
    "One model often has to serve two different jobs. It grows extra queries to make screens fast, while its business rules can make simple reads awkward. As dashboards, search, and reports grow, they put more pressure on the same model, even though reads and writes have different shapes and scaling needs.",
  solution:
    "Use one model to handle changes and another to answer queries. A command such as PlaceOrder goes to the write model, which loads the order, checks its rules, and saves the change. A Projector updates read models shaped for screens and reports, and queries use those read models. CQRS does not require separate databases or Event Sourcing; but when the Projector runs asynchronously, as it does here, the read side can briefly lag behind the latest write.",
  analogy:
    "A restaurant kitchen and its printed menu. The kitchen (write side) is organized around how dishes actually get cooked — stations, prep, timing — and enforces its own rules about what can be served. The menu (read side) is a separate, simplified summary printed for diners, updated whenever the kitchen changes what it offers. For a few minutes after a dish sells out, the menu might still list it — the menu is eventually consistent with the kitchen, not instantly.",
  whenToUse: [
    "Read and write workloads have very different shapes or very different scale (many more reads than writes, or vice versa).",
    "The read side needs denormalised, pre-joined views — dashboards, search indexes, reports — that would be awkward to serve from the write model.",
    "The write side has rich invariants worth protecting behind a real domain model, while most reads just need a flat projection.",
    "The write and read stores benefit from being different technologies entirely (a relational write store, a search-engine or cache-backed read store).",
  ],
  pros: [
    "Each side can be modeled, tested, scaled and even deployed independently of the other.",
    "Read models can be denormalised and pre-computed, so queries that would otherwise need expensive joins become a single lookup.",
    "The write model stays small and focused on invariants, instead of being stretched to also serve every read shape.",
    "New read models (a new report, a new search index) can be added later by writing a new projector, without touching the write side at all.",
  ],
  cons: [
    'If read models are updated asynchronously (common once the read and write stores are separate), a client can read stale data immediately after a write it just made, which surprises users and complicates UX ("why doesn\'t my order show up yet?").',
    "Two models (and often two stores) mean more moving parts to deploy, monitor and keep in sync than a single CRUD model.",
    "Projection logic is extra code that has to be kept correct and re-run if it was ever wrong or the read schema changes.",
    "Overkill for simple CRUD screens where the same shape genuinely works for both reading and writing. Martin Fowler warns that for most systems CQRS adds risky complexity, so apply it to the specific parts that need it, not a whole system.",
  ],
  realWorld: [
    "MediatR-based .NET services, where command and query request objects (IRequest<T>, often behind project-defined ICommand/IQuery markers) are dispatched to separate handler classes",
    "Denormalised read tables or materialized views kept in sync with a normalized write schema via change-data-capture or triggers",
    "Search indexes (Elasticsearch) populated from a relational write store by a background indexer",
    "Event-driven microservices where a write service emits events and read-optimized services build their own local views from them",
  ],
  concepts: [
    {
      term: "Command",
      description:
        "An intent to change state (PlaceOrder, CancelOrder). Named as an imperative verb, handled by exactly one handler, and does not return domain data.",
    },
    {
      term: "Query",
      description:
        "A request to read state that never changes anything. Can be handled directly against a read-optimized store, bypassing the write model entirely.",
    },
    {
      term: "Write model",
      description:
        "The model that accepts commands, enforces invariants, and is the single source of truth. Usually a normalized schema or an aggregate.",
    },
    {
      term: "Read model",
      description:
        "One or more denormalised, query-shaped views built specifically to answer the questions the UI or reports actually ask.",
    },
    {
      term: "Projection",
      description:
        "The process (and the resulting data) of transforming a write-side change into the shape a read model needs. Can run synchronously or, more commonly, asynchronously.",
    },
    {
      term: "Projector",
      description:
        "The component that turns write-side changes into read-model updates, usually asynchronously. The only thing that is allowed to write to the read store.",
    },
    {
      term: "Eventual consistency",
      description:
        "The read side is guaranteed to catch up with the write side eventually, but not instantly — there is a window where a query can return stale or missing data.",
    },
    {
      term: "Dispatcher",
      description:
        "Routes a command (or query) to the one handler registered to deal with it, so callers never hold a reference to a concrete handler.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "command",
        why: "Every write enters the system as a Command object — a named, serializable intent like PlaceOrder — rather than a direct method call, which is exactly the Command pattern.",
      },
      {
        slug: "mediator",
        why: "The Dispatcher is a Mediator (MediatR-style): callers send a command to it and never hold a reference to the concrete handler that will process it.",
      },
      {
        slug: "pub-sub",
        why: "Publishing a write-side change as a message lets one or more projectors update their read stores without the write side knowing or caring who is listening.",
      },
      {
        slug: "observer",
        why: "A Projector observes write-side changes and reacts by rebuilding its own denormalised view, the same relationship as Subject and Observer.",
      },
      {
        slug: "projection",
        why: "The Projector keeps the denormalised read store in step with the write side. The Projection pattern shows the same job fed by an event log: folding events into a query-shaped view, tracking a checkpoint so a redelivered event is harmless, and rebuilding the view from scratch.",
      },
      {
        slug: "repository",
        why: "Both the write store and the read store are exposed behind collection-like Repository interfaces, so handlers never write raw SQL or query DSLs directly.",
      },
      {
        slug: "chain-of-responsibility",
        why: "Cross-cutting checks in front of a handler — validation, authorization — are commonly built as a pipeline of handlers that each decide whether to pass the command on.",
      },
      {
        slug: "decorator",
        why: "Logging, validation and retry behaviour are often layered around a command or query handler as decorators, without changing the handler itself.",
      },
    ],
    architectures: [
      {
        slug: "layered",
        why: "CQRS's command and query sides can each be organized as their own small layered stack, sharing nothing below the application layer.",
      },
      {
        slug: "hexagonal",
        why: "Command and query handlers are naturally exposed as two separate driving ports into the same core, with the write and read stores plugged in as separate driven adapters.",
      },
      {
        slug: "ddd",
        why: "The command side's aggregate is exactly the DDD aggregate — it owns the invariants — while the query side bypasses the domain model entirely for read-optimized views.",
      },
      {
        slug: "event-sourcing",
        why: "Event Sourcing is the natural write-side partner: the events already written to the store are exactly what a projector folds into the read model.",
      },
      {
        slug: "functional-core",
        why: "Turning a write-model change into a read-model view is a pure function of data in, data out, making the projector a natural functional core wrapped by an imperative shell that does the actual I/O.",
      },
      {
        slug: "vertical-slice",
        why: "Vertical Slice organizes the same command/query split by feature — PlaceOrder and GetOrder are independent slices — rather than splitting the whole system into one write model and one read model.",
      },
      {
        slug: "microservices",
        why: "A service with its own read model, kept up to date from other services' published events instead of querying them synchronously, is CQRS applied at the service boundary rather than inside one process.",
      },
      {
        slug: "event-driven",
        why: "A CQRS projector is just another consumer on an event-driven broker: it subscribes to the events the write side publishes and folds them into its own read model.",
      },
    ],
  },

  // Diagram (viewBox 800 × 460, x/y are box centres)
  viewBox: "0 0 800 460",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 90,
      y: 50,
      description:
        "Sends commands to change state and queries to read it. It never knows (or needs to know) that two different models are answering those two kinds of requests.",
    },
    {
      id: "dispatcher",
      label: "Dispatcher",
      role: "Command routing",
      kind: "class",
      x: 300,
      y: 50,
      width: 160,
      description:
        "Looks up the one handler registered for a command's type and forwards it along, so the client never references a concrete handler class.",
      patterns: ["mediator"],
    },
    {
      id: "commandHandler",
      label: "PlaceOrderHandler",
      role: "Command handler",
      kind: "class",
      x: 530,
      y: 50,
      width: 190,
      description:
        "Handles exactly one command type: builds or loads the aggregate, lets it enforce its own rules, and persists the result through the write store.",
      patterns: ["command", "chain-of-responsibility", "decorator"],
    },
    {
      id: "aggregate",
      label: "Order (aggregate)",
      role: "Write model",
      kind: "object",
      x: 530,
      y: 130,
      width: 190,
      description:
        "The write-side domain object. It is the only thing allowed to decide whether a command is valid — the read side never touches it.",
    },
    {
      id: "writeStore",
      label: "WriteStore",
      role: "Write-side persistence",
      kind: "class",
      x: 530,
      y: 205,
      width: 190,
      description:
        "The source of truth. Normalized, optimized for protecting invariants and handling writes safely — not for answering arbitrary read questions quickly.",
      patterns: ["repository"],
    },
    {
      id: "projector",
      label: "Projector",
      role: "Write → read sync",
      kind: "class",
      x: 530,
      y: 275,
      width: 190,
      description:
        "Queues a write-side change and rebuilds a denormalised view for the read store only once something drains that queue — a deterministic stand-in for the lag a real asynchronous projector would have.",
      patterns: ["pub-sub", "observer", "projection"],
    },
    {
      id: "readStore",
      label: "ReadStore",
      role: "Read-side persistence",
      kind: "class",
      x: 530,
      y: 350,
      width: 190,
      description:
        "A denormalised store shaped exactly like the screens and reports that query it. Fast and simple to query, at the cost of only being as fresh as the last projection.",
      patterns: ["repository"],
    },
    {
      id: "queryHandler",
      label: "GetOrderSummaryHandler",
      role: "Query handler",
      kind: "class",
      x: 280,
      y: 420,
      width: 220,
      description:
        "Reads straight from the read store and returns a view model. It never touches the aggregate, the write store, or any business rule.",
    },
  ],
  relations: [
    {
      id: "sendCommand",
      from: "client",
      to: "dispatcher",
      type: "calls",
      label: "PlaceOrder command",
      description:
        "The client describes what it wants to happen as a command object and hands it to the dispatcher, rather than calling a handler directly.",
      code: "usage",
    },
    {
      id: "route",
      from: "dispatcher",
      to: "commandHandler",
      type: "calls",
      label: "dispatch(command)",
      description:
        'The dispatcher looks up the one handler registered for "PlaceOrder" and forwards the command to it.',
      code: "dispatcher",
    },
    {
      id: "applyRule",
      from: "commandHandler",
      to: "aggregate",
      type: "creates",
      label: "new Order(...)",
      description:
        "The handler builds the write-model aggregate, which is where invariants are enforced — here, an order total must be positive.",
      code: "aggregate",
    },
    {
      id: "persist",
      from: "commandHandler",
      to: "writeStore",
      type: "calls",
      label: "save(order)",
      description:
        "Once the aggregate is valid, the handler persists it. This write is synchronous and is what the client's command waits on.",
      code: "writeStore",
    },
    {
      id: "notifyProjector",
      from: "commandHandler",
      to: "projector",
      type: "notifies",
      label: "enqueue(order)",
      description:
        "Right after saving, the handler hands the order to the projector's queue. Enqueuing is instant, but nothing is projected into the read store yet — that only happens once something calls projector.catchUp(), which is exactly where the read side starts to lag.",
      bend: -120,
      code: "commandHandler",
    },
    {
      id: "project",
      from: "projector",
      to: "readStore",
      type: "calls",
      label: "upsert(view)",
      description:
        "When the projector's queue is drained by catchUp(), it turns each pending write-model shape into the read-model shape and writes it to the read store. This is the only path by which the read store ever changes.",
      code: "projector",
    },
    {
      id: "query",
      from: "client",
      to: "queryHandler",
      type: "calls",
      label: "GetOrderSummary(orderId)",
      description:
        "A query is a completely separate path from a command: it goes straight to a query handler that knows nothing about aggregates or invariants.",
      bend: 120,
      code: "usage",
    },
    {
      id: "read",
      from: "queryHandler",
      to: "readStore",
      type: "calls",
      label: "find(orderId)",
      description:
        "The query handler reads directly from the read store. If the projector has not run yet, this can return stale or missing data — the eventual-consistency trade-off.",
      code: "queryHandler",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Two models, two paths",
      description:
        "Commands flow down the write side: Dispatcher → CommandHandler → aggregate → WriteStore. Queries take a completely separate path straight into the ReadStore. A Projector is the only bridge between the two.",
      highlight: [
        "client",
        "dispatcher",
        "commandHandler",
        "aggregate",
        "writeStore",
        "projector",
        "readStore",
        "queryHandler",
      ],
    },
    {
      title: "Client sends a command",
      description:
        "The client does not call a method on a service — it builds a PlaceOrder command object describing what it wants, and hands it to the dispatcher.",
      highlight: ["client", "sendCommand", "dispatcher"],
      packets: [{ relation: "sendCommand", label: "PlaceOrder" }],
      notes: { dispatcher: "routing" },
      code: "usage",
    },
    {
      title: "Dispatcher routes it to the one registered handler",
      description:
        "The dispatcher looks up the handler registered for the command's type and forwards it. The client never references PlaceOrderHandler directly.",
      highlight: ["dispatcher", "route", "commandHandler"],
      packets: [{ relation: "route", label: "dispatch(command)" }],
      notes: { commandHandler: "handling" },
      code: "dispatcher",
    },
    {
      title: "The write model enforces the rules",
      description:
        'PlaceOrderHandler builds the Order aggregate, which rejects a non-positive total. This is the only place in the whole system where "is this command even valid?" gets decided.',
      highlight: ["commandHandler", "applyRule", "aggregate"],
      packets: [{ relation: "applyRule", label: "new Order(...)" }],
      notes: { aggregate: "validated" },
      code: "aggregate",
    },
    {
      title: "The write is persisted",
      description:
        "Once the aggregate is valid, the handler saves it to the WriteStore. The command the client sent is now durable — but the read side has not heard about it yet.",
      highlight: ["commandHandler", "persist", "writeStore"],
      packets: [{ relation: "persist", label: "save(order)" }],
      notes: { writeStore: "committed" },
      code: "writeStore",
    },
    {
      title: "The handler enqueues the projector",
      description:
        "Right after saving, the handler hands the order to the Projector's queue. Enqueuing is synchronous and instant, but that is not the same as projecting: nothing in the ReadStore has changed yet.",
      highlight: ["commandHandler", "notifyProjector", "projector"],
      packets: [{ relation: "notifyProjector", label: "enqueue(order)" }],
      notes: { projector: "queued" },
      code: "commandHandler",
    },
    {
      title: "Eventual consistency: a query can arrive too early",
      description:
        "The client queries for the order summary immediately after the command returns. The Projector's queue has not been drained yet, so the query gets nothing back — the write already succeeded, but the read model has not caught up. This is the trade-off CQRS makes explicit instead of hiding.",
      highlight: ["client", "query", "queryHandler", "read", "readStore"],
      packets: [
        { relation: "query", label: "GetOrderSummary(orderId)" },
        { relation: "read", label: "find(orderId) → (none yet)", after: 0 },
      ],
      notes: { readStore: "not yet projected" },
      code: "eventualConsistency",
    },
    {
      title: "The projector catches up",
      description:
        "Something — a worker loop, a scheduled job — calls projector.catchUp(). Only now does the Projector reshape the queued Order into a denormalised OrderSummaryView and write it to the ReadStore.",
      highlight: ["projector", "project", "readStore"],
      packets: [{ relation: "project", label: "upsert(view)" }],
      notes: { projector: "projecting", readStore: "catching up" },
      code: "projector",
    },
    {
      title: "A later query sees the projected view",
      description:
        "A moment later, once catchUp() has run, the exact same query now returns the denormalised OrderSummaryView — correct, but only as fresh as the last projection.",
      highlight: ["client", "query", "queryHandler", "read", "readStore"],
      packets: [
        { relation: "query", label: "GetOrderSummary(orderId)" },
        {
          relation: "read",
          label: "find(orderId) → view",
          reverse: false,
          after: 0,
        },
      ],
      notes: { readStore: "up to date" },
      code: "eventualConsistency",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: CqrsVisualization,
};
