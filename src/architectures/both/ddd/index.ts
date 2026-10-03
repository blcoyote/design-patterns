import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { DddVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "ddd",
  name: "Domain-Driven Design",
  paradigm: "both",
  order: 3,
  summary:
    "Use the business’s language in the code, and give each business area a model that fits its needs.",
  intent:
    "Put the business domain at the center of the design, not the database or framework. Use the business’s own language in the model, and split large systems into bounded contexts: areas with their own models and clear boundaries.",
  problem:
    "When teams share one model, the same word can mean different things to different parts of the business. Sales, Fulfillment, and Billing may each mean something different by “Order.” A single class then fills with optional fields and special cases. Business rules spread into validation code, and developers and domain experts can end up using different words for the same ideas.",
  solution:
    "Split a large system into bounded contexts. Each context has its own model and business vocabulary; the same word can mean different things in different contexts. Inside a context, use aggregates to protect business rules, value objects for data without identity, and domain events to record what happened. When contexts need to communicate, translate between their models at the boundary instead of exposing one model to the other. These boundaries are DDD’s strategic design; aggregates, value objects, repositories, and domain events are tactical patterns that work in both object-oriented and functional code.",
  analogy:
    "A hospital has an Admissions department and a Billing department. Both talk about \"the patient\", but Admissions cares about allergies and next of kin while Billing cares about insurance codes and copays — neither needs the other's fields, and forcing one \"Patient\" record to serve both departments would bloat it for everyone. Paperwork that crosses from Admissions to Billing goes through an intake form that translates one department's concerns into the other's, instead of Billing reaching into Admissions' filing cabinet directly.",
  whenToUse: [
    "The business domain is genuinely complex — not just a lot of CRUD screens, but real rules, policies and edge cases worth modeling explicitly.",
    'Multiple teams or subdomains keep colliding over what a shared term like "Order" or "Account" is supposed to mean.',
    "You can get regular access to a domain expert to build and refine a shared, precise vocabulary with.",
    "The system is large enough to be worth splitting into independently evolving bounded contexts.",
  ],
  pros: [
    "Business rules live in one place — the aggregate — instead of being scattered across controllers, services and ad-hoc validation.",
    "The ubiquitous language keeps code, conversation and documentation saying the same thing, which make domain bugs easier to spot in review.",
    "Bounded contexts let teams evolve their own models and release independently, without a single shared schema holding everyone back.",
    'Value objects and invariant-guarding aggregates make a whole category of "invalid state" bugs impossible to construct, not just unlikely.',
  ],
  cons: [
    "Significant upfront investment: identifying bounded contexts and building a real ubiquitous language takes time and close domain-expert access.",
    "Overkill for simple, mostly-CRUD applications — the ceremony of aggregates, repositories and events costs more than it returns.",
    "Getting bounded-context boundaries wrong is expensive to fix later, since contexts are meant to evolve independently once drawn.",
    "Anti-Corruption Layers and integration events add real plumbing and latency at every context boundary, compared to one shared model.",
  ],
  realWorld: [
    'Eric Evans\' original "Blue Book" examples — cargo shipping and route-booking domains — are the canonical reference point for the vocabulary.',
    "Reference e-commerce architectures (for example Microsoft's eShopOnContainers) split Catalog, Ordering, Basket and Identity into separate bounded contexts, each with its own database.",
    "Core banking and insurance platforms routinely separate Underwriting, Claims and Billing into distinct contexts connected by integration events.",
    'Large marketplaces split Catalog, Inventory, Ordering and Shipping so that each team\'s model of "a product" or "an order" only has to make sense inside its own context.',
  ],
  concepts: [
    {
      term: "Ubiquitous Language",
      description:
        'A vocabulary shared by developers and domain experts, used consistently in conversation, documentation and code, so a word like "placed" means exactly one thing within a context.',
    },
    {
      term: "Bounded Context",
      description:
        "An explicit boundary inside which a particular model and its ubiquitous language apply. The same word can mean something different in another context — that is a feature, not a bug.",
    },
    {
      term: "Context Map",
      description:
        "A diagram of how bounded contexts relate and integrate — which ones publish events, which are upstream or downstream, and where an Anti-Corruption Layer sits.",
    },
    {
      term: "Entity",
      description:
        'An object defined by a thread of identity that persists even as its attributes change over time — an OrderLine is still "the same line" after its quantity is corrected.',
    },
    {
      term: "Value Object",
      description:
        "An object defined entirely by its attributes, with no identity of its own. Two value objects with equal attributes are equal, and operations return new instances instead of mutating in place — Money is the textbook example.",
    },
    {
      term: "Aggregate / Aggregate Root",
      description:
        "A cluster of entities and value objects treated as one consistency boundary. The root — Order, here — is the only member external code is allowed to reference; everything inside it is reached only through the root.",
    },
    {
      term: "Domain Event",
      description:
        "Something that happened in the domain that other parts of the system may care about, named in the past tense — OrderPlaced. Raised by an aggregate, collected and dispatched by the application layer around it.",
    },
    {
      term: "Repository",
      description:
        "A collection-like abstraction for loading and saving a whole aggregate, so the rest of the context never has to know how — or where — it is actually stored.",
    },
    {
      term: "Domain Service",
      description:
        "A stateless operation that is a first-class domain concept but does not belong naturally on any single entity or value object, often because it spans more than one aggregate (for example a pricing or tax-calculation service).",
    },
    {
      term: "Factory",
      description:
        'Encapsulates the logic for constructing an aggregate in a valid starting state, so "an order that violates its own rules" is never a reachable state, not even for a moment.',
    },
    {
      term: "Anti-Corruption Layer",
      description:
        "A translation layer at a bounded-context boundary that converts one context's model and events into another's, so neither context's internals leak into the other.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "repository",
        why: "OrderRepository is how the aggregate is loaded and saved without ever exposing SQL, documents or any other storage detail to the rest of the context.",
      },
      {
        slug: "factory-method",
        why: "Order.create() is a factory method: it is the only way to construct an Order, guaranteeing the aggregate never exists in an invalid starting state.",
      },
      {
        slug: "unit-of-work",
        why: "Saving an aggregate root and everything it changed needs to commit as one atomic unit, which the repository's save() typically delegates to a Unit of Work.",
      },
      {
        slug: "pub-sub",
        why: "Once a domain event needs to leave the bounded context — as an integration event like ShipmentRequested — it travels the rest of the way over a publish/subscribe channel.",
      },
      {
        slug: "observer",
        why: "Inside the context, the application service collects events the aggregate raised and notifies whatever is listening — the same shape as an in-process Observer, just without a `notify()` call built into the aggregate.",
      },
      {
        slug: "adapter",
        why: "The Anti-Corruption Layer adapts OrderPlaced, Ordering's event, into ShipmentRequested, the shape Shipping actually expects.",
      },
      {
        slug: "facade",
        why: "The ACL also acts as a facade: the application service calls one simple translate() instead of understanding anything about how Shipping expects its events shaped.",
      },
      {
        slug: "strategy",
        why: 'Domain policies like "an order needs at least one line to be placed" are injected into the aggregate as interchangeable strategy objects instead of being hardcoded inside it.',
      },
      {
        slug: "state",
        why: "An aggregate's lifecycle — Draft, then Placed — is exactly the kind of state machine the State pattern formalizes; here it is guarded by a simple status field instead of a full class hierarchy.",
      },
    ],
    architectures: [
      {
        slug: "layered",
        why: "A single bounded context is still usually organized internally as layers — application service, aggregate, repository — layering just operates inside the context instead of across the whole system.",
      },
      {
        slug: "hexagonal",
        why: "Wrapping a bounded context in its own hexagon, with the aggregate and application service as the core and the repository as a driven adapter, is the standard way a context protects its inside from infrastructure.",
      },
      {
        slug: "cqrs",
        why: "The aggregate guarding its invariants is naturally the write side; a bounded context often grows a separate, denormalized read side once queries and commands pull the model in different directions.",
      },
      {
        slug: "event-sourcing",
        why: "Instead of storing only an aggregate's current fields, Event Sourcing persists every domain event it ever raised — including OrderPlaced — and rebuilds the aggregate by replaying them.",
      },
      {
        slug: "vertical-slice",
        why: "A slice can host its own narrow DDD aggregate for a feature with real invariants, or skip the domain model entirely for a simple CRUD-shaped slice like GetOrder.",
      },
      {
        slug: "microservices",
        why: "Microservices is the usual deployment answer to a bounded context: Ordering and Shipping here are exactly the kind of contexts that would each become their own service, each keeping its own database.",
      },
      {
        slug: "event-driven",
        why: "A bounded context's domain events become integration events the moment they cross its boundary onto a broker, for other bounded contexts to subscribe to independently.",
      },
    ],
  },

  // Diagram (custom scene — two dashed bounded-context regions joined by an ACL)
  viewBox: "0 0 920 560",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 160,
      y: 55,
      description:
        "A caller outside the Ordering bounded context — a UI, another service, anything that wants an order placed. It never reaches past the application service.",
    },
    {
      id: "appService",
      label: "OrderApplicationService",
      role: "Application service",
      kind: "class",
      x: 160,
      y: 165,
      width: 180,
      description:
        "Ordering's single entry point. It orchestrates a use case — load, change, save, dispatch events — but holds no business rules of its own.",
      patterns: ["factory-method", "observer"],
    },
    {
      id: "orderRepo",
      label: "OrderRepository",
      role: "Repository",
      kind: "interface",
      x: 160,
      y: 275,
      width: 180,
      description:
        "Loads and saves the Order aggregate as a whole, so nothing above it ever has to know whether that means a SQL table, a document store, or something else.",
      patterns: ["repository", "unit-of-work"],
    },
    {
      id: "money",
      label: "Money",
      role: "Value object",
      kind: "object",
      x: 160,
      y: 385,
      width: 150,
      description:
        "Immutable and compared by value, not identity: two Money instances with the same amount and currency are equal, and every operation returns a new instance.",
    },
    {
      id: "order",
      label: "Order",
      role: "Aggregate root",
      kind: "object",
      x: 380,
      y: 215,
      width: 190,
      description:
        "The aggregate root: the only object outside this cluster that code is allowed to reference. It guards its own invariant — no new lines once it has been placed — regardless of who is calling.",
      patterns: ["strategy", "state"],
    },
    {
      id: "orderLine",
      label: "OrderLine",
      role: "Entity",
      kind: "object",
      x: 380,
      y: 325,
      width: 160,
      description:
        "Part of the Order aggregate, reachable only through it. It has identity inside the aggregate even though none of its own fields ever change.",
    },
    {
      id: "orderPlaced",
      label: "OrderPlaced",
      role: "Domain event",
      kind: "object",
      x: 380,
      y: 440,
      width: 170,
      description:
        "Raised by Order the moment it is placed, and collected by the application service. The aggregate itself has no idea who — if anyone — is listening.",
    },
    {
      id: "acl",
      label: "ACL",
      role: "Anti-Corruption Layer",
      kind: "class",
      x: 550,
      y: 440,
      width: 120,
      description:
        "Sits directly on the seam between the two contexts and translates Ordering's OrderPlaced into Shipping's own ShipmentRequested, so neither context's model leaks into the other.",
      patterns: ["adapter", "facade"],
    },
    {
      id: "shipping",
      label: "ShippingService",
      role: "Shipping bounded context",
      kind: "class",
      x: 740,
      y: 325,
      width: 190,
      description:
        'Lives entirely inside the Shipping bounded context. It has never heard of an "Order" — only of a ShipmentRequested, the vocabulary its own context understands.',
      patterns: ["pub-sub"],
    },
  ],
  relations: [
    {
      id: "cmd",
      from: "client",
      to: "appService",
      type: "calls",
      label: "placeOrder(cmd)",
      description:
        "The client sends a command. OrderApplicationService is the only thing in Ordering it is allowed to call directly.",
      code: "appService",
    },
    {
      id: "load",
      from: "appService",
      to: "orderRepo",
      type: "calls",
      label: "findById(orderId)",
      description:
        "The application service asks the repository for the aggregate by id, instead of knowing anything about how it is stored.",
      bend: -24,
      code: "orderRepo",
    },
    {
      id: "manages",
      from: "orderRepo",
      to: "order",
      type: "holds",
      description:
        "The repository is the only object whose job is to know where an Order lives. Everything else works with the aggregate purely in memory.",
    },
    {
      id: "addLine",
      from: "appService",
      to: "order",
      type: "calls",
      label: "addLine(item)",
      description:
        "The application service asks the aggregate to change. Order enforces its own rule about when a line can be added — the service never checks that itself.",
      code: "order",
    },
    {
      id: "computeTotal",
      from: "order",
      to: "money",
      type: "calls",
      label: "total()",
      description:
        "Order folds its lines into a single Money total, using Money.add() so nothing ever treats money as a raw number.",
      code: "money",
    },
    {
      id: "owns",
      from: "order",
      to: "orderLine",
      type: "holds",
      description:
        "Order holds its OrderLines directly. Nothing outside the aggregate is allowed to reach an OrderLine except through Order itself.",
    },
    {
      id: "raise",
      from: "order",
      to: "orderPlaced",
      type: "creates",
      label: "raises OrderPlaced",
      description:
        "The moment Order's state actually changes, it appends a domain event to its own internal list — it does not call out to anything to do this.",
      code: "orderPlaced",
    },
    {
      id: "save",
      from: "appService",
      to: "orderRepo",
      type: "calls",
      label: "save(order)",
      description:
        "Once the aggregate is valid, the application service persists it through the repository, then pulls whatever events it just raised.",
      bend: 24,
      code: "orderRepo",
    },
    {
      id: "cross",
      from: "orderPlaced",
      to: "acl",
      type: "notifies",
      label: "OrderPlaced",
      description:
        "OrderPlaced reaches the boundary of the Ordering context. It goes no further in its own shape — Shipping is never handed an Ordering type directly.",
      code: "acl",
    },
    {
      id: "translate",
      from: "acl",
      to: "shipping",
      type: "calls",
      label: "ShipmentRequested",
      description:
        "The ACL hands Shipping a ShipmentRequested — a type that belongs to Shipping's own vocabulary, built from what the ACL read off OrderPlaced.",
      code: "shipping",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Two bounded contexts, bridged by an ACL",
      description:
        "Ordering and Shipping are separate bounded contexts, each with its own model and its own language for an order. They share no code or database. An Anti-Corruption Layer translates between them.",
      highlight: [
        "client",
        "appService",
        "orderRepo",
        "money",
        "order",
        "orderLine",
        "orderPlaced",
        "acl",
        "shipping",
      ],
    },
    {
      title: "A command reaches the application service",
      description:
        "A place-order command arrives from outside the context. OrderApplicationService is Ordering's single entry point — no caller reaches the aggregate or the repository directly.",
      highlight: ["client", "cmd", "appService"],
      packets: [{ relation: "cmd", label: "placeOrder(cmd)" }],
      notes: { appService: "orchestrating" },
      code: "appService",
    },
    {
      title: "It loads the aggregate through the repository",
      description:
        "OrderApplicationService asks OrderRepository for the Order by id. The repository is the only participant that knows how an Order is actually stored.",
      highlight: ["appService", "load", "orderRepo", "manages", "order"],
      packets: [
        { relation: "load", label: "findById(orderId)" },
        { relation: "load", label: "Order", reverse: true, after: 0 },
      ],
      notes: { orderRepo: "loading" },
      code: "orderRepo",
    },
    {
      title: "Lines are added while the order is still a draft",
      description:
        "OrderApplicationService adds each requested line through Order.addLine(). The order is still a draft, so the invariant that guards it — no lines once placed — has nothing to object to yet.",
      highlight: ["appService", "addLine", "order"],
      packets: [{ relation: "addLine", label: "addLine(item)" }],
      notes: { order: "draft — accepting lines" },
      code: "order",
    },
    {
      title: "The total is computed with an immutable value object",
      description:
        "Order.total folds every OrderLine through Money.add(), which returns a new Money each time rather than mutating one in place. Money has no identity — only the amount and currency matter.",
      highlight: ["order", "computeTotal", "money", "owns", "orderLine"],
      packets: [{ relation: "computeTotal", label: "total()" }],
      notes: { money: "value equality, immutable" },
      code: "money",
    },
    {
      title: "Placing the order raises a domain event",
      description:
        "place() is the moment the aggregate's state actually changes. It appends an OrderPlaced domain event to its own list — the aggregate has no idea who, if anyone, is listening.",
      highlight: ["order", "raise", "orderPlaced"],
      packets: [{ relation: "raise", label: "OrderPlaced" }],
      notes: { orderPlaced: "collected, not yet published" },
      code: "orderPlaced",
    },
    {
      title: "The application service saves and collects the event",
      description:
        "OrderApplicationService persists the aggregate through the repository, then pulls the events Order just raised. Collecting and dispatching events is the application service's job, not the aggregate's.",
      highlight: ["appService", "save", "orderRepo"],
      packets: [{ relation: "save", label: "save(order)" }],
      notes: { orderRepo: "persisted" },
      code: "orderRepo",
    },
    {
      title: "The event crosses the boundary through the ACL",
      description:
        "OrderPlaced never reaches Shipping directly — Shipping shouldn't even know Ordering's model exists. The Anti-Corruption Layer translates it into ShipmentRequested, the vocabulary Shipping actually understands.",
      highlight: ["orderPlaced", "cross", "acl", "translate", "shipping"],
      packets: [
        { relation: "cross", label: "OrderPlaced" },
        { relation: "translate", label: "ShipmentRequested", after: 0 },
      ],
      notes: { acl: "translates", shipping: "ShipmentRequested received" },
      code: "acl",
    },
    {
      title: "Afterwards, the aggregate still guards its invariant",
      description:
        "placeOrder has already returned. Calling addLine() directly on the now-placed order throws anyway — the invariant lives inside the aggregate itself, so it holds no matter who calls it, or when, not only while the application service is orchestrating.",
      highlight: ["appService", "addLine", "order"],
      packets: [{ relation: "addLine", label: "addLine(item) ✗" }],
      notes: { order: "rejected — already placed" },
      code: "order",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: DddVisualization,
};
