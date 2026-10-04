import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { HexagonalVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "hexagonal",
  name: "Hexagonal (Ports & Adapters)",
  paradigm: "oo",
  order: 2,
  summary:
    "Keep business rules separate from technology, so databases, web handlers, and test tools can be swapped.",
  intent:
    "Keep application and business logic in a core that depends only on interfaces, called ports. Put technology-specific code, such as HTTP, SQL, and message queues, in adapters outside the core. Adapters depend on the core, not the other way around.",
  problem:
    'In a typical layered service the application layer ends up importing a concrete SQL repository, a concrete SMTP client, and a concrete web framework type somewhere along the call chain. Testing the business logic then means spinning up a database or mocking a dozen concrete classes, and swapping Postgres for DynamoDB means touching code that was supposed to be about "placing an order", not "talking to Postgres".',
  solution:
    "The core exposes ports that outside code can call, and uses ports for work it needs done. These are called driving and driven ports. An HTTP controller, CLI, or test harness is a driving adapter: it calls into the core. A database repository, mailer, or in-memory fake is a driven adapter: it implements a port the core uses. Because the core depends on interfaces it owns, you can replace an adapter, such as swapping a real database for an in-memory one in tests, without changing the core.",
  analogy:
    'A wall socket does not care whether a lamp, a laptop charger or a vacuum cleaner is plugged into it — it only cares that the plug matches the socket\'s shape. The appliance ("adapter") can be swapped freely because the wall\'s wiring ("the core") only ever commits to the socket\'s interface, never to a specific appliance.',
  whenToUse: [
    "The domain logic is valuable enough to deserve tests that run in milliseconds, with no database, network or framework in the loop.",
    "The team expects to swap infrastructure — a different database, a different message broker, a new UI — without rewriting business rules.",
    "Several front ends (HTTP API, CLI, scheduled job) need to trigger the exact same use cases.",
    "The project previously suffered from business logic leaking into controllers or ORM entities and wants a structural rule that prevents it from happening again.",
  ],
  pros: [
    "The core can be unit tested with plain in-memory fakes — no database, no HTTP server, no mocking framework required.",
    "Infrastructure decisions (which database, which mail provider) can be deferred or changed late, because the core was never written against them.",
    "Multiple driving adapters (HTTP, CLI, message consumer) can share the exact same use case, guaranteeing they behave identically.",
    'The dependency rule is enforceable by tooling: a linter or module boundary can forbid the core from importing anything under an "adapters" folder.',
  ],
  cons: [
    "Small CRUD services pay a real tax in interfaces, wiring and indirection for a benefit they may never cash in.",
    'Naming is genuinely confusing at first — "port", "driving", "driven" and "adapter" do not map onto words most teams already use.',
    "It is still easy to accidentally leak a framework type (an HTTP request object, an ORM entity) into the core through a driving port's method signature if nobody is watching.",
    "A team that only needs testable services can often get much of the benefit from Layered plus a repository interface, with less ceremony.",
  ],
  realWorld: [
    'Any Spring Boot / NestJS service built around "service interface + repository interface" with adapters wired up by the DI container',
    'Netflix\'s and many fintechs\' public write-ups describing "ports and adapters" or "hexagonal" service boundaries',
    "Test suites that swap a real payment gateway or email provider for an in-memory fake implementing the same interface",
    "Plugin-style systems (editors, build tools) where the core defines an extension interface and plugins are adapters around it",
  ],
  concepts: [
    {
      term: "Core",
      description:
        "The application and domain logic together — use cases plus the entities and rules they operate on. It depends on nothing outside itself.",
    },
    {
      term: "Port",
      description:
        "An interface owned by the core. A driving port is called by the outside world; a driven port is called by the core and implemented outside it.",
    },
    {
      term: "Driving adapter (primary)",
      description:
        "Something that calls into the core through a driving port — an HTTP controller, a CLI command, a test, a message consumer.",
    },
    {
      term: "Driven adapter (secondary)",
      description:
        "Something the core calls out to through a driven port — a Postgres repository, an SMTP mailer, an in-memory fake.",
    },
    {
      term: "Dependency inversion",
      description:
        "Adapters depend on the core's interfaces; the core never depends on an adapter. Arrows always point inward, toward the hexagon.",
    },
    {
      term: "Symmetry",
      description:
        'Driving and driven sides are architecturally the same idea — "something outside plugs into a port the core defines" — just facing opposite directions.',
    },
  ],
  variants: [
    {
      name: "Clean Architecture",
      description:
        "Robert C. Martin's concentric-circles take on the same idea: Entities, Use Cases, Interface Adapters and Frameworks/Drivers, with the same inward-only dependency rule, just drawn as rings instead of a hexagon.",
    },
    {
      name: "Onion Architecture",
      description:
        "Jeffrey Palermo's version, which puts the domain model at the very centre, domain services around it, then application services, with infrastructure and UI as the outermost ring — again, dependencies only ever point toward the centre.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "adapter",
        why: "Every driven or driving adapter is, literally, an Adapter: it translates between the core's port interface and whatever a database, message broker or HTTP framework actually expects.",
      },
      {
        slug: "dependency-injection",
        why: "Wiring a concrete adapter into the core at startup — instead of the core constructing it — is what makes the swap at the edges possible in the first place.",
      },
      {
        slug: "repository",
        why: "The most common driven port is a Repository: the core declares `save` in its own vocabulary and leaves the storage technology to an adapter.",
      },
      {
        slug: "strategy",
        why: 'A driven port behaves exactly like a Strategy interface — the core holds a reference to "some implementation of OrderRepository" and is indifferent to which one it got.',
      },
      {
        slug: "facade",
        why: "A driving port such as PlaceOrderUseCase is a small Facade: it gives every driving adapter one call that hides the orchestration happening inside the core.",
      },
      {
        slug: "null-object",
        why: "A no-op adapter (a mailer that does not actually send, a repository that discards writes) is a Null Object slotted into a driven port for tests or local development.",
      },
      {
        slug: "plugin",
        why: "Adapters are plugged into ports at composition time: the core only knows the port interface, and which implementation fills it (Postgres, in-memory, a no-op) is chosen by configuration, not by the core.",
      },
    ],
    architectures: [
      {
        slug: "layered",
        why: "Hexagonal keeps Layered's top-to-bottom flow for a single request, but turns the dependency rule inside-out: every arrow points toward the core instead of toward the database.",
      },
      {
        slug: "ddd",
        why: "The hexagon is usually where a DDD bounded context lives — aggregates and domain services sit in the core, repositories are driven ports, and the ACL is itself a pair of adapters.",
      },
      {
        slug: "functional-core",
        why: "Both push effects to the edges; Hexagonal does it with interfaces and classes, Functional Core / Imperative Shell does it with plain functions and a thin shell that performs the I/O.",
      },
      {
        slug: "cqrs",
        why: "The driving side splits cleanly along CQRS lines: a PlaceOrderUseCase port for commands and a separate query port for reads, each with its own adapters.",
      },
      {
        slug: "microservices",
        why: "Each microservice is internally a hexagon of its own — its core stays framework-free, while HTTP controllers and repository adapters are what expose it to, and connect it from, other services.",
      },
    ],
  },

  // Diagram (viewBox 800 × 460, x/y are box centres)
  viewBox: "0 0 800 460",
  participants: [
    {
      id: "httpController",
      label: "HttpOrderController",
      role: "Driving adapter",
      kind: "class",
      x: 95,
      y: 110,
      width: 150,
      description:
        "Translates an inbound HTTP request into a PlaceOrderCommand and calls the driving port. It depends on PlaceOrderUseCase, never on PlaceOrderService directly.",
      code: "controller",
      patterns: ["adapter"],
    },
    {
      id: "testHarness",
      label: "Test harness",
      role: "Driving adapter",
      kind: "client",
      x: 95,
      y: 350,
      width: 150,
      description:
        "A unit test that calls the exact same driving port as the HTTP controller, but wires in an in-memory driven adapter instead of a real database.",
      code: "test",
      patterns: ["adapter"],
    },
    {
      id: "placeOrderPort",
      label: "PlaceOrderUseCase",
      role: "Driving port",
      kind: "interface",
      x: 250,
      y: 230,
      width: 140,
      description:
        "An interface the core owns and exposes. Any driving adapter that wants to place an order must go through this port — never through PlaceOrderService's concrete class.",
      code: "port",
      patterns: ["facade"],
    },
    {
      id: "service",
      label: "PlaceOrderService",
      role: "Core — application",
      kind: "class",
      x: 400,
      y: 140,
      width: 160,
      description:
        "Implements the driving port. Orchestrates the use case: builds the Order, lets it enforce its own rules, then saves it through the driven port. Never imports Postgres, HTTP, or any adapter type.",
      code: "service",
      patterns: ["dependency-injection"],
    },
    {
      id: "order",
      label: "Order",
      role: "Core — domain",
      kind: "object",
      x: 400,
      y: 320,
      width: 150,
      description:
        "A plain domain entity with no knowledge of any adapter. It enforces its own invariant — every line item needs a positive price — regardless of who constructed it.",
      code: "order",
    },
    {
      id: "orderRepoPort",
      label: "OrderRepository",
      role: "Driven port",
      kind: "interface",
      x: 550,
      y: 230,
      width: 140,
      description:
        "An interface the core owns and calls out through. The core knows it can `save` an order; it has no idea whether that write lands in Postgres or a plain array.",
      code: "repoPort",
      patterns: ["repository", "strategy", "plugin"],
    },
    {
      id: "postgresAdapter",
      label: "PostgresOrderRepository",
      role: "Driven adapter",
      kind: "class",
      x: 705,
      y: 110,
      width: 170,
      description:
        "Implements OrderRepository against a real database. Used in production; the core never references this class by name.",
      code: "postgres",
      patterns: ["adapter"],
    },
    {
      id: "inMemoryAdapter",
      label: "InMemoryOrderRepository",
      role: "Driven adapter",
      kind: "class",
      x: 705,
      y: 350,
      width: 170,
      description:
        "Implements OrderRepository as a plain in-memory list. Plugged in by the test harness so tests run in milliseconds with zero infrastructure. The same port also has a genuine Null Object next to it in the code — NullOrderRepository — which discards every write instead of keeping one, as a safe default for local development.",
      code: "inMemory",
      patterns: ["adapter", "null-object"],
    },
  ],
  relations: [
    {
      id: "implPort",
      from: "service",
      to: "placeOrderPort",
      type: "implements",
      label: "implements",
      description:
        "PlaceOrderService realizes the PlaceOrderUseCase interface. The core commits to the port's contract, not the other way round.",
    },
    {
      id: "implPg",
      from: "postgresAdapter",
      to: "orderRepoPort",
      type: "implements",
      label: "implements",
      description:
        "PostgresOrderRepository realizes OrderRepository. The core never names this class.",
    },
    {
      id: "implMem",
      from: "inMemoryAdapter",
      to: "orderRepoPort",
      type: "implements",
      label: "implements",
      description:
        "InMemoryOrderRepository realizes the same OrderRepository interface, which is what makes it a drop-in replacement for Postgres.",
    },
    {
      id: "reqHttp",
      from: "httpController",
      to: "placeOrderPort",
      type: "calls",
      label: "execute(command)",
      description:
        "The HTTP controller calls the driving port with a PlaceOrderCommand built from the request body. It never touches PlaceOrderService by name.",
      code: "controller",
    },
    {
      id: "reqTest",
      from: "testHarness",
      to: "placeOrderPort",
      type: "calls",
      label: "execute(command)",
      description:
        "The test calls the exact same driving port the HTTP controller calls — the only difference is which driven adapter was wired in underneath.",
      code: "test",
      bend: -40,
    },
    {
      id: "portToService",
      from: "placeOrderPort",
      to: "service",
      type: "calls",
      label: "dispatches to",
      description:
        "At runtime the port reference actually points at a PlaceOrderService instance, so the call lands there.",
      code: "service",
    },
    {
      id: "invariant",
      from: "service",
      to: "order",
      type: "calls",
      label: "addLine(item)",
      description:
        "The service asks the domain entity to apply the change. The rule that a line item needs a positive price lives in Order, not in the service or any adapter.",
      code: "order",
    },
    {
      id: "repoCall",
      from: "service",
      to: "orderRepoPort",
      type: "calls",
      label: "save(order)",
      description:
        "The core calls out through the driven port. It has no idea yet whether that lands in Postgres or an in-memory list.",
      code: "repoPort",
    },
    {
      id: "pgQuery",
      from: "orderRepoPort",
      to: "postgresAdapter",
      type: "calls",
      label: "INSERT INTO orders …",
      description:
        "In production the port reference points at PostgresOrderRepository, which turns the Order into SQL and runs it.",
      code: "postgres",
    },
    {
      id: "memSave",
      from: "orderRepoPort",
      to: "inMemoryAdapter",
      type: "calls",
      label: "saved.push(order)",
      description:
        "In the test, the exact same port reference instead points at InMemoryOrderRepository, which just appends to a list.",
      code: "inMemory",
      bend: -40,
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "A hexagon with ports on its edges",
      description:
        "The core — PlaceOrderService and Order — sits in the middle. It exposes a driving port on the left (PlaceOrderUseCase) and depends on a driven port on the right (OrderRepository). Adapters plug into both without the core ever naming them.",
      highlight: [
        "httpController",
        "testHarness",
        "placeOrderPort",
        "service",
        "order",
        "orderRepoPort",
        "postgresAdapter",
        "inMemoryAdapter",
        "implPort",
        "implPg",
        "implMem",
      ],
    },
    {
      title: "A request enters through a driving adapter",
      description:
        "HttpOrderController receives the HTTP request, builds a PlaceOrderCommand, and calls the driving port. It depends only on the PlaceOrderUseCase interface.",
      highlight: ["httpController", "reqHttp", "placeOrderPort"],
      packets: [{ relation: "reqHttp", label: "execute(command)" }],
      notes: { placeOrderPort: "driving port" },
      code: "controller",
    },
    {
      title: "The port dispatches into the core",
      description:
        "At runtime the port reference actually points at PlaceOrderService. The controller never knew that — it only ever called an interface.",
      highlight: ["placeOrderPort", "portToService", "service"],
      packets: [{ relation: "portToService", label: "dispatches to" }],
      notes: { service: "orchestrating" },
      code: "service",
    },
    {
      title: "The core enforces its own rule",
      description:
        "PlaceOrderService asks the Order entity to add each line. Order rejects a non-positive price itself — the rule lives in the domain, not in any adapter.",
      highlight: ["service", "invariant", "order"],
      packets: [{ relation: "invariant", label: "addLine(item)" }],
      notes: { order: "enforces positive price" },
      code: "order",
    },
    {
      title: "The core calls out through a driven port",
      description:
        "With a valid Order built, the service calls save() on OrderRepository — a port it owns. It still has no idea which adapter answers.",
      highlight: ["service", "repoCall", "orderRepoPort"],
      packets: [{ relation: "repoCall", label: "save(order)" }],
      notes: { orderRepoPort: "driven port" },
      code: "repoPort",
    },
    {
      title: "In production, Postgres answers the port",
      description:
        "The driven port is wired to PostgresOrderRepository, which turns the Order into an INSERT and runs it against a real database.",
      highlight: ["orderRepoPort", "pgQuery", "postgresAdapter"],
      packets: [{ relation: "pgQuery", label: "INSERT INTO orders …" }],
      notes: { postgresAdapter: "1 row written" },
      code: "postgres",
    },
    {
      title: "The result returns the same way it came in",
      description:
        "Nothing shortcuts the round trip: the saved Order flows back up through the service to the controller, which turns it into a 201 response. The core never saw HTTP; the controller never saw SQL.",
      highlight: ["reqHttp", "portToService", "repoCall"],
      packets: [
        { relation: "repoCall", label: "ok", reverse: true },
        { relation: "portToService", label: "Order", reverse: true, after: 0 },
        { relation: "reqHttp", label: "201 Created", reverse: true, after: 1 },
      ],
      notes: { httpController: "201 Created" },
      code: "controller",
    },
    {
      title: "The payoff: swap the adapter, not the core",
      description:
        "A test calls the exact same PlaceOrderUseCase port, but is wired to InMemoryOrderRepository instead of Postgres. PlaceOrderService and Order are not touched, mocked, or recompiled — only the adapter plugged into the driven port changed.",
      highlight: [
        "testHarness",
        "reqTest",
        "placeOrderPort",
        "orderRepoPort",
        "memSave",
        "inMemoryAdapter",
      ],
      packets: [
        { relation: "reqTest", label: "execute(command)" },
        { relation: "memSave", label: "saved.push(order)", after: 0 },
      ],
      notes: { inMemoryAdapter: "1 order, 0 infrastructure" },
      code: "test",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: HexagonalVisualization,
};
