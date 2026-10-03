import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { LayeredVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "layered",
  name: "Layered (N-tier)",
  paradigm: "oo",
  order: 1,
  summary:
    "Stack the app into presentation, application, domain and data-access layers that only talk downward.",
  intent:
    "Organize a system into horizontal layers — presentation, application, domain, data access — where each layer depends only on the layer directly beneath it, so a change to how data is stored never has to ripple up into how requests are handled.",
  problem:
    "Without an agreed layering, a web handler ends up calling the database directly, business rules get duplicated between the controller and a service class, and nobody can say with confidence where a given piece of logic is supposed to live. Every change risks touching everything, because there is no rule about what is allowed to call what.",
  solution:
    "Draw a strict stack — Presentation → Application → Domain → Data access — and enforce a single rule: a layer may only call the layer immediately below it, never sideways and never skipping ahead. A request flows down the stack, gets handled, and the result flows back up through the same layers. Swapping the database, adding caching, or reworking the UI only ever touches one layer at a time.",
  analogy:
    "A company's reporting chain: a customer talks to the front desk, the front desk escalates to a case manager, the case manager consults a specialist, and the specialist pulls a file from records. The customer never phones records directly — every request goes down one level at a time, and the answer travels back the same way.",
  whenToUse: [
    "The team needs a simple, well-understood default and does not yet have a strong reason for something more elaborate.",
    'Responsibilities keep landing in the wrong place because there is no shared rule for "what calls what".',
    "The application is a fairly standard CRUD-shaped service with one primary data store.",
    "Onboarding matters: layered architecture is the architecture most new hires already recognize.",
  ],
  pros: [
    "Easy to learn, explain and onboard new developers into — almost every backend developer has seen this shape before.",
    'A clear rule ("only call the layer below you") makes code review straightforward: a violation is easy to spot.',
    "Each layer can be tested in isolation by substituting the layer below it with a fake or an in-memory implementation.",
    "Works well for straightforward, data-centric applications without forcing unnecessary ceremony.",
  ],
  cons: [
    "Nothing in a plain class stops a developer from skipping layers under deadline pressure — the rule is a convention, not a compiler error.",
    'A "fat domain layer" problem can creep in the other direction: an anemic domain layer that is just data, with all real logic piling up in the application layer.',
    "Strict layering can mean a trivial change (adding one field) still has to touch four layers top to bottom.",
    "Compared to Hexagonal or DDD, it gives weaker isolation for the domain: the domain layer typically still depends on data-access types, not the other way around.",
  ],
  realWorld: [
    'The classic ASP.NET / Spring "Controller → Service → Repository → Database" stack',
    "Rails' implicit MVC-plus-service-objects layering in larger apps",
    "Most generated CRUD scaffolding (Django, Laravel, NestJS) defaults to this shape out of the box",
    'Traditional enterprise "3-tier" (web tier / app tier / DB tier) deployment diagrams',
  ],
  concepts: [
    {
      term: "Presentation layer",
      description:
        "Handles requests and responses — HTTP controllers, CLI commands, GraphQL resolvers. Talks only to the application layer.",
    },
    {
      term: "Application layer",
      description:
        "Orchestrates a use case: loads what it needs, calls into the domain, and persists the result. Contains no business rules of its own.",
    },
    {
      term: "Domain layer",
      description:
        "The actual business rules and invariants, expressed as plain objects with no knowledge of HTTP, SQL, or any other outer layer.",
    },
    {
      term: "Data access layer",
      description:
        "Translates between domain objects and whatever the storage technology needs — SQL, a document store, an external API.",
    },
    {
      term: "Layering violation",
      description:
        "A call that skips a layer (e.g. a controller querying the database directly). The classic failure mode of this architecture — see the final step.",
    },
    {
      term: "N-tier",
      description:
        "A near-synonym, usually describing the same layers mapped onto separate physical or deployable tiers rather than just code modules.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "facade",
        why: "The application layer's service is a facade: it gives the presentation layer one simple call that hides the orchestration happening underneath.",
      },
      {
        slug: "repository",
        why: "The data-access layer is almost always exposed as a Repository, so the layers above it work with domain objects and never see SQL.",
      },
      {
        slug: "unit-of-work",
        why: "Saving an aggregate and everything it touched in one transaction is naturally expressed as a Unit of Work at the data-access boundary.",
      },
      {
        slug: "dependency-injection",
        why: "Each layer is constructed against the interface of the layer below it, wired together by a container at startup instead of hardcoded references.",
      },
      {
        slug: "proxy",
        why: "Cross-cutting concerns like transactions, caching or authorization are often added as a proxy wrapped around a layer's service, without the layer above noticing.",
      },
    ],
    architectures: [
      {
        slug: "hexagonal",
        why: "Hexagonal is where Layered usually evolves: it keeps the layers but inverts the bottom one, so the domain owns the repository interface and the database becomes a plug-in adapter.",
      },
      {
        slug: "ddd",
        why: "The domain layer is where a DDD model lives — aggregates, value objects and domain services — with the application layer orchestrating use cases on top of it.",
      },
      {
        slug: "cqrs",
        why: "When reads and writes start pulling the same service layer in opposite directions, CQRS splits the stack into a command path and a lean query path that can skip the domain layer.",
      },
      {
        slug: "mvc",
        why: "MVC is usually how a layered app organizes its presentation layer internally: a Controller like OrderController routes a request into the layer below it, with one or more Views rendering whatever comes back.",
      },
      {
        slug: "vertical-slice",
        why: "Vertical Slice is the feature-cut alternative to Layered: instead of a shared OrderController → OrderService → OrderRepository stack, each feature (PlaceOrder, GetOrder) owns its own handler and data access end to end.",
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
      x: 120,
      y: 65,
      description:
        "A browser, mobile app or other caller. It only ever talks to the presentation layer, never to anything beneath it.",
    },
    {
      id: "controller",
      label: "OrderController",
      role: "Presentation layer",
      kind: "class",
      x: 460,
      y: 65,
      width: 190,
      description:
        "Translates an HTTP request into a call on the application layer, and the result back into an HTTP response. Holds no business logic.",
      patterns: ["dependency-injection"],
    },
    {
      id: "service",
      label: "OrderService",
      role: "Application layer",
      kind: "class",
      x: 460,
      y: 155,
      width: 190,
      description:
        'Orchestrates the "place an order" use case: builds the domain object, asks it to enforce its own rules, then hands it to the data-access layer to persist.',
      patterns: ["facade", "proxy"],
    },
    {
      id: "order",
      label: "Order",
      role: "Domain layer",
      kind: "object",
      x: 460,
      y: 245,
      width: 160,
      description:
        "A plain domain object with no knowledge of HTTP or SQL. It enforces its own invariant — every line item must have a positive price — regardless of who is calling it.",
    },
    {
      id: "repository",
      label: "OrderRepository",
      role: "Data access layer",
      kind: "class",
      x: 460,
      y: 335,
      width: 190,
      description:
        "Translates between Order objects and the database: builds the SQL, runs it, and is the only layer that knows the shape of the orders table.",
      patterns: ["repository", "unit-of-work"],
    },
    {
      id: "database",
      label: "Database",
      role: "External infrastructure",
      kind: "class",
      x: 460,
      y: 425,
      width: 160,
      description:
        "The actual data store. In a correctly layered system, only the data-access layer ever talks to it directly.",
    },
  ],
  relations: [
    {
      id: "http",
      from: "client",
      to: "controller",
      type: "calls",
      label: "HTTP POST /orders",
      description:
        "The client sends a request. The presentation layer is the only layer the outside world is allowed to see.",
      code: "controller",
    },
    {
      id: "place",
      from: "controller",
      to: "service",
      type: "calls",
      label: "placeOrder(items)",
      description:
        "The controller does not build an Order or touch the database itself — it delegates the whole use case to the application layer.",
      code: "placeOrder",
    },
    {
      id: "invariant",
      from: "service",
      to: "order",
      type: "calls",
      label: "addLine(item)",
      description:
        "The application layer asks the domain object to apply the change. The rule that a line item needs a positive price lives in Order, not in OrderService.",
      code: "order",
    },
    {
      id: "save",
      from: "service",
      to: "repository",
      type: "calls",
      label: "save(order)",
      description:
        "Once the domain object is valid, the application layer hands it to the data-access layer to persist. OrderService never builds SQL itself.",
      code: "save",
    },
    {
      id: "query",
      from: "repository",
      to: "database",
      type: "calls",
      label: "INSERT INTO orders …",
      description:
        "The repository is the only place that knows the orders table exists. Everything above it only ever sees Order objects.",
      code: "save",
    },
    {
      id: "violation",
      from: "controller",
      to: "database",
      type: "calls",
      label: "✗ SELECT * FROM orders",
      description:
        "The classic failure mode: a controller reaching straight past Application and Domain into Data access. Nothing in a plain class stops this — only discipline and review do.",
      bend: 260,
      code: "violation",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "A stack of layers, each depending on the one below",
      description:
        "Presentation, Application, Domain and Data access are stacked top to bottom. The rule is simple: a layer may call the layer directly beneath it, and nothing else — never sideways, never skipping ahead.",
      highlight: ["client", "controller", "service", "order", "repository", "database"],
    },
    {
      title: "Request enters at the presentation layer",
      description:
        "The client sends an HTTP request. OrderController is the only participant the outside world ever talks to directly.",
      highlight: ["client", "http", "controller"],
      packets: [{ relation: "http", label: "HTTP POST /orders" }],
      notes: { controller: "routing" },
      code: "controller",
    },
    {
      title: "Controller delegates to the application layer",
      description:
        "The controller calls placeOrder() on OrderService and gets out of the way. It holds no business logic of its own.",
      highlight: ["controller", "place", "service"],
      packets: [{ relation: "place", label: "placeOrder(items)" }],
      notes: { service: "orchestrating" },
      code: "placeOrder",
    },
    {
      title: "Application layer manipulates the domain",
      description:
        "OrderService builds an Order and asks it to add each line. Order enforces its own invariant — a positive price — no matter who calls it.",
      highlight: ["service", "invariant", "order"],
      packets: [{ relation: "invariant", label: "addLine(item)" }],
      notes: { order: "enforces positive price" },
      code: "order",
    },
    {
      title: "Service persists through the data-access layer",
      description:
        "With a valid Order in hand, OrderService hands it to OrderRepository. It never builds a SQL statement itself.",
      highlight: ["service", "save", "repository"],
      packets: [{ relation: "save", label: "save(order)" }],
      notes: { repository: "writing" },
      code: "save",
    },
    {
      title: "Repository translates the write into SQL",
      description:
        "OrderRepository is the only participant that knows the orders table exists. It turns the Order into an INSERT and runs it.",
      highlight: ["repository", "query", "database"],
      packets: [{ relation: "query", label: "INSERT INTO orders …" }],
      notes: { database: "1 row written" },
      code: "save",
    },
    {
      title: "The result bubbles back up, layer by layer",
      description:
        "Nothing shortcuts the stack on the way back either: the saved Order flows up through the service to the controller, which turns it into an HTTP response.",
      highlight: ["save", "place", "http"],
      packets: [
        { relation: "save", label: "ok", reverse: true },
        { relation: "place", label: "Order", reverse: true, after: 0 },
        { relation: "http", label: "201 Created", reverse: true, after: 1 },
      ],
      notes: { controller: "201 Created" },
      code: "controller",
    },
    {
      title: "Anti-pattern: skipping layers",
      description:
        'A "quick" debug endpoint has the controller query the database directly. It now knows SQL, can no longer be tested without a real database, and nothing below it can change without risking breaking the controller too — the exact coupling layering exists to prevent.',
      highlight: ["controller", "violation", "database"],
      packets: [{ relation: "violation", label: "✗ SELECT * FROM orders" }],
      notes: { controller: "now knows SQL", database: "tightly coupled" },
      code: "violation",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: LayeredVisualization,
};
