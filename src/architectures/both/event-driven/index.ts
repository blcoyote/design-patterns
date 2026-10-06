import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { EventDrivenVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "event-driven",
  name: "Event-Driven Architecture",
  paradigm: "both",
  order: 10,
  summary:
    "Producers publish facts to a broker; independent consumers react to the ones they care about, with no central coordinator.",
  intent:
    "Decouple the part of the system that knows something happened from every part that reacts to it. A producer publishes an event to a broker by topic name and moves on; any number of consumers — zero, one, or a dozen — subscribe to that topic and react independently, without the producer ever knowing they exist.",
  problem:
    "A producer that calls every interested party directly — send an email, update inventory, log analytics — has to import all of them, know their APIs, and grow a new call every time something else wants to react. Adding a consumer means editing the producer; removing one means hunting down every call site. The producer also ends up waiting on (or breaking because of) code that has nothing to do with its own job.",
  solution:
    "Introduce a broker that sits between everyone. Producers publish events — named facts in the past tense, like OrderPlaced — to a topic, and never call a consumer directly. Consumers subscribe to the topics they care about and react on their own schedule. In the choreography style shown here, consumers can themselves publish further events (Inventory reacts to OrderPlaced by publishing StockReserved) without any central process telling them to — the next step in the flow is a decision each consumer makes for itself, not a plan written down anywhere.",
  analogy:
    'A newsroom wire service. A reporter files a story to the wire under a category — "sports", "weather" — and has no idea which newspapers, radio stations or apps are subscribed to that category, or how many. A subscriber can start or stop pulling from "sports" at any time without calling the reporter, and the reporter never changes a single word of how they file a story because of it.',
  whenToUse: [
    "Multiple independent parts of the system need to react to the same fact, and that list keeps growing.",
    "Producers and consumers are owned, built or deployed independently and should not import each other.",
    "You want to add or remove a reaction to something happening without redeploying the thing that made it happen.",
    "The reactions do not all need to happen in the same transaction as the fact itself — some lag before a consumer catches up is acceptable.",
  ],
  pros: [
    "Producers and consumers are decoupled from each other — neither references the other's type, only the broker and a topic/event contract.",
    "New consumers can be added, and old ones removed, without changing a single producer.",
    "One event can fan out to any number of consumers, including zero, and consumers can react at their own pace.",
    "Choreography has no single orchestrator to become a bottleneck or a single point of failure for the whole flow (the broker itself is still shared infrastructure that must be made highly available).",
  ],
  cons: [
    'Harder to trace end-to-end: reading publish("OrderPlaced", …) alone does not tell you everything that will eventually happen because of it.',
    'Choreography spreads "what happens next" across every consumer\'s own code — there is no one place to read the whole business process.',
    "Delivery guarantees are a real design decision: at-least-once delivery means consumers must tolerate (or explicitly deduplicate) redelivered events.",
    "A typo in a topic name fails silently — nothing was subscribed, nothing happens, no error.",
  ],
  realWorld: [
    "Apache Kafka, RabbitMQ and other log- or queue-based message brokers routing events by topic",
    "AWS EventBridge, SNS and Google Cloud Pub/Sub for event fan-out between independently deployed services",
    "Domain-event dispatch inside a single process, built on Node.js EventEmitter, .NET events, or an in-process bus",
    "Retail order pipelines where Payments, Inventory, Shipping and Notifications each subscribe to the same order-placed event independently",
  ],
  concepts: [
    {
      term: "Event",
      description:
        "An immutable fact, named in the past tense — OrderPlaced, not PlaceOrder — announcing that something already happened. Nobody can veto it after the fact.",
    },
    {
      term: "Topic",
      description:
        "The named channel an event is published under. Producers and consumers agree on topic names and event shapes; that is the entire contract between them.",
    },
    {
      term: "Broker",
      description:
        "The component both sides depend on. Routes a published event to every handler subscribed to its topic, and nothing more — it has no idea what any handler does.",
    },
    {
      term: "Producer",
      description:
        "Publishes events without knowing — or caring — who is subscribed, or how many consumers (if any) will react.",
    },
    {
      term: "Consumer (subscriber)",
      description:
        "Reacts to events on topics it chose to subscribe to. Added or removed without ever touching the producer.",
    },
    {
      term: "Choreography",
      description:
        "Each consumer decides for itself what to do next, including publishing further events — the flow emerges from independent local decisions, with no central script.",
    },
    {
      term: "Orchestration",
      description:
        "A central orchestrator (often called a process manager, or an orchestration-based saga) explicitly calls each step in order and tracks where the overall flow is — the opposite end of the spectrum from choreography. A saga can be coordinated either way.",
    },
    {
      term: "Delivery guarantee",
      description:
        "Whether the broker promises an event is delivered at most once, at least once, or exactly once. At-least-once is common and pushes consumers toward idempotent or deduplicating handlers.",
    },
  ],
  variants: [
    {
      name: "Choreography vs. orchestration",
      description:
        "Choreography (shown here): every consumer reacts independently and may itself publish further events, with no central coordinator. Orchestration: a central orchestrator (a process manager, or an orchestration-based saga) explicitly drives each step and knows the whole flow.",
    },
    {
      name: "Event notification vs. event-carried state transfer",
      description:
        "An event notification (closest to what is shown here) carries just enough to identify what happened — here orderId, item, quantity — and expects an interested consumer to ask for more if it needs it (no consumer in this scenario does). Event-carried state transfer instead embeds a full copy of the changed data in the event itself, so consumers never need to call back.",
    },
    {
      name: "Broker topology vs. mediator topology",
      description:
        "Mark Richards' terms: a broker topology (shown here) is a lightweight, topic-routing broker with no workflow logic — consumers decide everything. A mediator topology adds a central event mediator that knows the steps of a specific business process, which is orchestration implemented at the messaging layer.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "pub-sub",
        why: "EventBroker is a Pub/Sub broker: producers publish to a topic name, consumers subscribe to a topic name, and neither ever references the other directly.",
      },
      {
        slug: "outbox",
        why: "A producer that saves its own data and then publishes an event has two writes with no shared transaction. Outbox writes the event to a table in the same database transaction and lets a relay publish it, so OrderPlaced is never lost when the broker or the process fails (consumers then see it at-least-once).",
      },
      {
        slug: "observer",
        why: "Observer is the in-process, synchronous ancestor of this: a subject calls its observers directly and waits, where EventBroker's consumers are reached through a topic and a queue instead.",
      },
      {
        slug: "mediator",
        why: "In the broker topology shown here the broker centralizes routing but not workflow; a mediator topology goes further and adds an orchestrator that also centralizes the sequence of steps, which is the full Mediator pattern applied to messaging.",
      },
      {
        slug: "command",
        why: 'ReserveStock would be a command — a one-handler "do this" — while OrderPlaced is an event: a many-handler "this happened" that the producer broadcasts without expecting any particular consumer to act on it.',
      },
      {
        slug: "chain-of-responsibility",
        why: "Inventory's subscribed handler is wrapped by dedupe(), a tiny consumer-side pipeline that decides whether to pass a message on to the real handler or drop it — the same shape as a Chain of Responsibility link.",
      },
    ],
    architectures: [
      {
        slug: "event-sourcing",
        why: "Event Sourcing uses events as the durable source of truth that state is rebuilt from; here, OrderPlaced and StockReserved are integration messages used once and then forgotten — easy to confuse, genuinely different jobs.",
      },
      {
        slug: "cqrs",
        why: "A CQRS read model is a natural consumer on this broker: it subscribes to the same events a write-side handler already publishes and folds them into its own projection.",
      },
      {
        slug: "microservices",
        why: "Independently deployed services commonly integrate by publishing and subscribing to events like OrderPlaced instead of calling each other's APIs directly, trading a direct dependency for a shared topic and event contract.",
      },
      {
        slug: "ddd",
        why: "A bounded context's domain events become integration events the moment they cross its boundary onto a broker like this one, for other bounded contexts to subscribe to.",
      },
      {
        slug: "pipes-and-filters",
        why: "A consumer that needs to transform a stream of events — parse, validate, enrich, format — is often built as a pipes-and-filters pipeline downstream of the broker, with each filter a pure stage over the incoming messages.",
      },
    ],
  },

  // Diagram (custom scene — vertical broker band between producer and consumers)
  viewBox: "0 0 850 560",
  participants: [
    {
      id: "producer",
      label: "OrdersProducer",
      role: "Producer",
      kind: "class",
      x: 110,
      y: 260,
      width: 170,
      description:
        "Publishes OrderPlaced whenever an order is placed. It depends on EventBroker and a topic name only — it has never heard of EmailConsumer, InventoryConsumer, AnalyticsConsumer or LoyaltyConsumer, and never changes when one of them is added or removed.",
    },
    {
      id: "broker",
      label: "EventBroker",
      role: "Broker",
      kind: "class",
      x: 440,
      y: 260,
      width: 190,
      description:
        "The only thing producers and consumers both depend on. Publishing enqueues a message; drain() delivers it FIFO to every handler subscribed to that topic — including messages a handler enqueues while draining.",
      patterns: ["pub-sub"],
    },
    {
      id: "email",
      label: "EmailConsumer",
      role: "Consumer",
      kind: "class",
      x: 750,
      y: 80,
      width: 180,
      description:
        "Subscribes to OrderPlaced and sends a confirmation every time it fires — including when the same order is redelivered, since it has no deduplication of its own.",
    },
    {
      id: "inventory",
      label: "InventoryConsumer",
      role: "Consumer",
      kind: "class",
      x: 750,
      y: 230,
      width: 190,
      description:
        "Subscribes to OrderPlaced behind a dedupe() pipeline, reserves stock, and — choreography in action — publishes StockReserved itself. No orchestrator told it to; it decided on its own.",
      patterns: ["chain-of-responsibility"],
    },
    {
      id: "analytics",
      label: "AnalyticsConsumer",
      role: "Consumer",
      kind: "class",
      x: 750,
      y: 380,
      width: 190,
      description:
        "Subscribes to OrderPlaced purely to keep a running count. It has no dedupe pipeline, so a redelivered event is counted again.",
    },
    {
      id: "loyalty",
      label: "LoyaltyConsumer",
      role: "Consumer (added later)",
      kind: "class",
      x: 750,
      y: 500,
      width: 190,
      description:
        "Subscribes to OrderPlaced after the system is already running. OrdersProducer is never touched to make this consumer exist — that is the whole point of publishing to a topic instead of calling consumers directly.",
    },
  ],
  relations: [
    {
      id: "sub-email",
      from: "email",
      to: "broker",
      type: "calls",
      label: "subscribe()",
      description: "EmailConsumer registers a handler for OrderPlaced on startup.",
      code: "usage",
      bend: -10,
    },
    {
      id: "sub-inventory",
      from: "inventory",
      to: "broker",
      type: "calls",
      label: "subscribe()",
      description:
        "InventoryConsumer registers a handler too, but wrapped in dedupe() first — the broker only ever sees one subscribed function and has no idea it is a pipeline.",
      code: "usage",
    },
    {
      id: "sub-analytics",
      from: "analytics",
      to: "broker",
      type: "calls",
      label: "subscribe()",
      description: "AnalyticsConsumer subscribes to the same topic, purely to count.",
      code: "usage",
      bend: 10,
    },
    {
      id: "sub-loyalty",
      from: "loyalty",
      to: "broker",
      type: "calls",
      label: "subscribe() (added later)",
      description:
        "LoyaltyConsumer subscribes after the first order has already flowed through the system — the broker, the producer and every other consumer are completely unaffected.",
      code: "usage",
      bend: 18,
    },
    {
      id: "publish",
      from: "producer",
      to: "broker",
      type: "calls",
      label: "publish(OrderPlaced)",
      description:
        'OrdersProducer calls broker.publish("OrderPlaced", event). This only enqueues the message — nothing is delivered yet.',
      code: "producer",
    },
    {
      id: "notify-email",
      from: "broker",
      to: "email",
      type: "notifies",
      label: "OrderPlaced",
      description: "When drain() processes OrderPlaced, the broker calls EmailConsumer's handler.",
      code: "broker",
      bend: -22,
    },
    {
      id: "notify-inventory",
      from: "broker",
      to: "inventory",
      type: "notifies",
      label: "OrderPlaced",
      description:
        "The same drain() call also reaches InventoryConsumer's dedupe-wrapped handler, in subscription order.",
      code: "broker",
    },
    {
      id: "notify-analytics",
      from: "broker",
      to: "analytics",
      type: "notifies",
      label: "OrderPlaced",
      description: "...and AnalyticsConsumer's handler, last in subscription order.",
      code: "broker",
      bend: 22,
    },
    {
      id: "notify-loyalty",
      from: "broker",
      to: "loyalty",
      type: "notifies",
      label: "OrderPlaced",
      description:
        "Once LoyaltyConsumer has subscribed, it receives every OrderPlaced delivered after that point exactly like the other three.",
      code: "broker",
      bend: 32,
    },
    {
      id: "publish-stock",
      from: "inventory",
      to: "broker",
      type: "calls",
      label: "publish(StockReserved)",
      description:
        "InventoryConsumer's handler publishes StockReserved itself — choreography: the next step in the flow is a decision Inventory makes, not one the broker or a central process makes for it.",
      code: "inventory",
      bend: -16,
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Choreography: no central coordinator",
      description:
        "OrdersProducer and four consumers all depend only on EventBroker — none of them references another directly. Inventory will itself publish StockReserved later in this scenario, a decision no orchestrator makes for it.",
      highlight: ["producer", "broker", "email", "inventory", "analytics", "loyalty"],
    },
    {
      title: "Consumers subscribe at startup",
      description:
        'Email, Inventory and Analytics each call broker.subscribe("OrderPlaced", handler). The broker just appends each handler to a list for that topic name — it has no idea which classes these are, or what they do.',
      highlight: [
        "broker",
        "sub-email",
        "sub-inventory",
        "sub-analytics",
        "email",
        "inventory",
        "analytics",
      ],
      notes: {
        broker: "topics: 1 (OrderPlaced)",
        email: "listening",
        inventory: "listening (deduped)",
        analytics: "listening",
      },
      code: "usage",
    },
    {
      title: "The producer publishes — nothing is delivered yet",
      description:
        "OrdersProducer calls broker.publish('OrderPlaced', event) for order 1. publish() only enqueues the message; drain() has not run, so no consumer has reacted yet.",
      highlight: ["producer", "publish", "broker"],
      packets: [{ relation: "publish", label: "OrderPlaced(1, WIDGET, 2)" }],
      notes: { broker: "queue: 1" },
      code: "producer",
    },
    {
      title: "drain() delivers it to all three subscribers",
      description:
        "broker.drain() dequeues OrderPlaced and calls every OrderPlaced handler in subscription order: Email sends a confirmation, Inventory reserves stock, Analytics counts — the exact same event, three independent reactions.",
      highlight: [
        "broker",
        "notify-email",
        "notify-inventory",
        "notify-analytics",
        "email",
        "inventory",
        "analytics",
      ],
      packets: [
        { relation: "notify-email", label: "OrderPlaced" },
        { relation: "notify-inventory", label: "OrderPlaced" },
        { relation: "notify-analytics", label: "OrderPlaced" },
      ],
      notes: {
        email: "confirmation sent",
        inventory: "reserved 2 x WIDGET",
        analytics: "order count: 1",
      },
      code: "broker",
    },
    {
      title: "Inventory published StockReserved on its own",
      description:
        "This already happened during the drain above: inside its handler, right after reserving stock and before Analytics ran, InventoryConsumer called broker.publish('StockReserved', …) itself. This is choreography: nothing told Inventory to do this except its own reaction to OrderPlaced.",
      highlight: ["inventory", "publish-stock", "broker"],
      packets: [{ relation: "publish-stock", label: "StockReserved(1, WIDGET)" }],
      notes: { broker: "queue: 1 (StockReserved)" },
      code: "inventory",
    },
    {
      title: "drain() continues — to zero subscribers",
      description:
        "drain() keeps going and dequeues StockReserved, but nothing in this scenario subscribed to that topic, so no handler runs. Publishing never fails just because nobody is listening yet.",
      highlight: ["broker"],
      notes: { broker: "StockReserved delivered to 0 subscribers" },
      code: "broker",
    },
    {
      title: "At-least-once redelivery: only Inventory notices",
      description:
        "The same OrderPlaced for order 1 is published again, simulating the duplicate an at-least-once broker redelivery or a producer retry would cause. Email and Analytics have no deduplication, so they react again; Inventory's dedupe() pipeline recognizes order 1 and drops it before the real handler ever runs.",
      highlight: [
        "broker",
        "notify-email",
        "notify-inventory",
        "notify-analytics",
        "email",
        "inventory",
        "analytics",
      ],
      packets: [
        { relation: "notify-email", label: "OrderPlaced (redelivered)" },
        { relation: "notify-inventory", label: "OrderPlaced (redelivered)" },
        { relation: "notify-analytics", label: "OrderPlaced (redelivered)" },
      ],
      notes: {
        email: "confirmation sent (again)",
        inventory: "duplicate ignored",
        analytics: "order count: 2",
      },
      code: "dedupe",
    },
    {
      title: "A new consumer joins — the producer never changes",
      description:
        "LoyaltyConsumer subscribes to OrderPlaced after the fact. OrdersProducer, EventBroker and every other consumer are untouched. The next order OrdersProducer publishes reaches all four consumers, including the one that did not exist a moment ago.",
      highlight: [
        "loyalty",
        "sub-loyalty",
        "producer",
        "publish",
        "broker",
        "notify-email",
        "notify-inventory",
        "notify-analytics",
        "notify-loyalty",
      ],
      packets: [
        { relation: "publish", label: "OrderPlaced(2, GADGET, 1)" },
        { relation: "notify-email", label: "OrderPlaced", after: 0 },
        { relation: "notify-inventory", label: "OrderPlaced", after: 0 },
        { relation: "notify-analytics", label: "OrderPlaced", after: 0 },
        { relation: "notify-loyalty", label: "OrderPlaced", after: 0 },
      ],
      notes: { loyalty: "points awarded", analytics: "order count: 3", producer: "unchanged" },
      code: "usage",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: EventDrivenVisualization,
};
