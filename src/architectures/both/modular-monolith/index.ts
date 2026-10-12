import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { ModularMonolithVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "modular-monolith",
  name: "Modular Monolith",
  paradigm: "both",
  order: 14,
  summary:
    "One deployable application split into modules with enforced boundaries: each module exposes a small public API, keeps its data private, and talks to other modules only in-process, by call or by event.",
  intent:
    "Build the system as a single deployable application whose inside is divided into modules, each with a small public API and private data, and let a module reach another only through that API or through an event. The boundaries are the ones a set of services would have, but they are crossed by in-process calls instead of network calls.",
  problem:
    "A monolith without internal boundaries slowly turns into a big ball of mud: any class can call any other, one team's table is another team's join, and a change in one corner breaks code nobody knew depended on it. The usual escape, splitting into microservices, trades that coupling for a distributed system: network failures, eventual consistency, many pipelines to run and a lot of infrastructure, long before the team or the load needs it.",
  solution:
    "Keep one process and one deployment, but draw the module boundaries as strictly as you would between services. Each module has a public API (a facade) and a private implementation and store; other modules see only the API and the contract types it returns, never the module's internal records. Modules that must react to each other publish integration events on an in-process bus instead of calling each other directly. A composition root, here the ModuleHost, starts the modules, hands each one only what it declared it needs, and refuses lookups of modules it did not declare. In a real codebase an architecture test or the compiler enforces the same rule, so a forbidden dependency fails the build instead of rotting the design.",
  analogy:
    "An office building with several departments on separate floors. Everyone shares one lobby, one lift and one lease, so moving a document between floors is a short walk, not a courier trip. But each department keeps its own filing cabinets locked, and the only way to get something from another floor is to go to its reception desk and ask. If one department later outgrows the building, it can move out as a whole, because its desk was already the only door.",
  whenToUse: [
    "You want clear boundaries between parts of the domain, but the team, the load or the release cadence do not (yet) justify running separate services.",
    "A single codebase is getting hard to change, and the fix is to restore internal structure rather than to add network hops.",
    "You expect that some module may one day be extracted into a service, and want its API and data ownership ready for that.",
    "You want one deployment, one transaction scope per module and in-process calls, with the operational simplicity of a single application.",
  ],
  pros: [
    "One deployable and one process: no network between modules, no service discovery, and a call between modules can be stepped through in one debugger.",
    "Modules cannot quietly reach into each other's data, so a module's schema or internal types can change without breaking its neighbours.",
    "Calls and events stay in-process, so a module call is fast and cannot fail the way a remote call can.",
    "A module with a narrow API and its own data is the natural unit to extract into a service later, if that ever becomes necessary.",
  ],
  cons: [
    "The boundaries hold only while something enforces them: if nothing but discipline stops a cross-module import or a shared table, they erode. Languages differ in how much the compiler helps.",
    "Everything still ships, scales and fails together: one module's memory leak or slow code path affects the whole process, and one release carries every module's changes.",
    "In-process events are not reliable by themselves: a handler runs on the publisher's call stack, so a slow or failing handler affects the publisher, and an event published without an outbox can be lost if the process dies at the wrong moment.",
    "Teams share one codebase and one build, so they need an agreed process for API changes and the boundary checks in CI, which is work a single big module never asks for.",
  ],
  realWorld: [
    "Shopify runs a very large Ruby on Rails application as a modular monolith and open-sourced Packwerk, a tool that checks the boundaries between its packages.",
    "Spring Modulith, a Spring project, helps build modular monoliths on the JVM: it verifies the module structure, and its application events can be recorded in an event publication registry so they are not lost.",
    "Kamil Grzybek's modular-monolith-with-ddd repository on GitHub is a well-known .NET reference that combines modules, bounded contexts and integration events.",
    "Architecture-test tools make the boundaries checkable: ArchUnit for Java, NetArchTest for .NET and import-linter for Python, while Go's internal/ directories are enforced by the compiler.",
  ],
  concepts: [
    {
      term: "Module",
      description:
        "A cohesive slice of the domain (here Catalog, Ordering, Shipping) with a public API, a private implementation and its own data. It is the unit that owns its decisions and, if the need ever comes, the unit you could extract.",
    },
    {
      term: "Public API (module facade)",
      description:
        "The small, deliberate surface a module offers the others, here CatalogApi, OrderingApi and ShippingApi. It returns contract types such as ProductInfo, never the module's internal records.",
    },
    {
      term: "Private data / schema per module",
      description:
        "Each module owns its data and no other module reads or writes it directly. In this example it is a private in-memory store; in a real system it is a schema or tables (or a separate database) that only that module's code touches.",
    },
    {
      term: "In-process integration event",
      description:
        "A message like OrderPlaced that one module publishes and others subscribe to, delivered on the same call stack instead of over a network. The publisher does not know who listens, and the subscriber depends on the event's shape, not on the publisher.",
    },
    {
      term: "Declared dependencies / boundary enforcement",
      description:
        "Each module states which modules it may use (Ordering declares Catalog, Shipping declares none), and a check refuses anything else. Here the ModuleHost refuses the lookup; in a real codebase architecture tests or the compiler fail the build.",
    },
    {
      term: "Composition root / host",
      description:
        "The one place that knows every module: it starts them, wires each one to the shared bus and to the modules it declared, and so keeps the modules from constructing or finding each other themselves.",
    },
  ],
  variants: [
    {
      name: "Stepping stone to microservices",
      description:
        "Start as a modular monolith and extract a module into a service only when it needs to scale, deploy or fail on its own. Because callers already go through its API and its data is private, the in-process call becomes a remote one without a rewrite of its neighbours, though the call then has to cope with network failure.",
    },
    {
      name: "Schema-per-module vs database-per-module",
      description:
        "Modules can share one database server but each own a separate schema or set of tables that no other module queries, or each can have a separate database. A schema per module is simpler to operate, while a database per module is a stricter boundary and easier to extract later, but takes away a single transaction across modules.",
    },
    {
      name: "Modular monolith with an outbox",
      description:
        "The publishing module saves its event into its own data in the same transaction as the change, and a relay then delivers it to the bus. With durable storage, the event can then no longer be lost between saving the change and publishing it. This example has no outbox and publishes directly; its stores are in memory, so here a crash would lose the order and the event alike.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "facade",
        why: "CatalogApi, OrderingApi and ShippingApi are each a small facade in front of a module's private store and implementation. Ordering calls CatalogApi.getProduct and gets a ProductInfo; Catalog's internal record, with its supplierCode, never leaves the module.",
      },
      {
        slug: "pub-sub",
        why: "Ordering publishes OrderPlaced on the InProcessEventBus without knowing who is listening, and Shipping subscribes when it starts. Unlike a networked broker, the bus here is a list of handlers that publish calls synchronously, in subscription order.",
      },
      {
        slug: "dependency-injection",
        why: "ModuleHost is the composition root: it builds each module's ModuleContext and passes it to the module's factory, so the module gets the shared bus and the APIs it declared from outside instead of creating them. Ordering pulls CatalogApi with ctx.use(\"catalog\"), which the host allows only because Ordering declared that dependency, so this is closer to a service locator than to constructor injection.",
      },
      {
        slug: "outbox",
        why: "In this code placeOrder stores the order and then calls the bus's publish in the same call, with no outbox. The stores here are in memory, so a crash loses the order and the event alike; once Ordering saves orders durably, a crash between the two steps would keep the order but lose its event. An outbox would write OrderPlaced into Ordering's own data in the same transaction as the order, and a relay would publish it afterwards, so the order and its event are saved together or not at all.",
      },
    ],
    architectures: [
      {
        slug: "microservices",
        why: "Catalog, Ordering and Shipping keep the boundaries that Orders, Inventory and Payments have on the Microservices page (private data, access only through an API, OrderPlaced as the only coupling), but Ordering reaches CatalogApi with an ordinary in-process call. There is no InventoryServiceClient-style proxy, cache or circuit breaker, because this call cannot fail like a network call. Extracting a module into a service later turns that call into the remote one.",
      },
      {
        slug: "ddd",
        why: "A module here is the kind of boundary a DDD bounded context draws: Ordering and Shipping each keep their own model and data, and share only the contract types ProductInfo and OrderPlaced. This example has no aggregates, domain events or ACL of its own; the DDD page shows what goes on inside a context.",
      },
      {
        slug: "event-driven",
        why: "Ordering publishes OrderPlaced and Shipping reacts without either knowing the other, as on the Event-Driven page. The InProcessEventBus here is only a list of handlers called synchronously on the publisher's call stack, with no queue, no persistence and no asynchronous delivery, so a failing handler affects the publisher.",
      },
      {
        slug: "hexagonal",
        why: "Both keep a module's inside behind a small boundary: CatalogApi, OrderingApi and ShippingApi play the part an inbound port plays on the Hexagonal page, and each module's store is private. This example does not structure a module as ports and adapters, but a module could be built as a hexagon inside, with its own core and driven adapters.",
      },
      {
        slug: "microkernel",
        why: "A module is a natural home for the Microkernel shape. Ordering could be a small core that takes its region-specific rules as plug-ins, installed through a versioned contract it checks, as ClaimsCore does with apiVersion. This example has no plug-ins: every module is started by the ModuleHost, and the host checks only declared dependencies, not versions.",
      },
    ],
  },

  viewBox: "0 0 1140 700",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 110,
      y: 200,
      description:
        "A caller outside the monolith. It uses only the modules' public APIs (here OrderingApi.placeOrder and CatalogApi.setPrice) and never sees a module's store or implementation.",
    },
    {
      id: "host",
      label: "ModuleHost",
      role: "Composition root",
      kind: "class",
      x: 640,
      y: 120,
      width: 190,
      description:
        "The composition root of the single deployable. register starts a module by calling its factory immediately and keeps only the API it returns, and use(requester, target) returns a module's API only if the requester declared that dependency; otherwise it fails with an error.",
      patterns: ["dependency-injection"],
      code: "host",
    },
    {
      id: "catalogApi",
      label: "CatalogApi",
      role: "Catalog public API",
      kind: "interface",
      x: 360,
      y: 290,
      width: 180,
      description:
        "The public API of the Catalog module: getProduct returns a ProductInfo and setPrice changes a price. It is a small facade; the module's records stay behind it.",
      patterns: ["facade"],
      code: "catalog",
    },
    {
      id: "catalogStore",
      label: "catalog data",
      role: "Catalog private data",
      kind: "object",
      x: 360,
      y: 450,
      width: 160,
      description:
        "Catalog's private store of product records, each with an internal supplierCode that no other module ever sees. How it is hidden depends on the language: a closure in TypeScript, a private nested class in C#, an underscore-prefixed class by convention in Python, an unexported struct in Go.",
      code: "catalog",
    },
    {
      id: "orderingApi",
      label: "OrderingApi",
      role: "Ordering public API",
      kind: "interface",
      x: 640,
      y: 290,
      width: 180,
      description:
        "The public API of the Ordering module: placeOrder and orderTotal. At start-up Ordering asks the host for CatalogApi once, which the host allows because Ordering declared catalog as a dependency.",
      patterns: ["facade"],
      code: "ordering",
    },
    {
      id: "orderingStore",
      label: "ordering data",
      role: "Ordering private data",
      kind: "object",
      x: 590,
      y: 450,
      width: 160,
      description:
        "Ordering's private store of orders. Each stored line keeps its own copy of the unit price taken when the order was placed, so Ordering never has to ask Catalog again.",
      code: "ordering",
    },
    {
      id: "shippingApi",
      label: "ShippingApi",
      role: "Shipping public API",
      kind: "interface",
      x: 920,
      y: 290,
      width: 180,
      description:
        "The public API of the Shipping module: statusFor. Shipping declares no module dependencies; it learns about orders only by subscribing to OrderPlaced on the bus.",
      patterns: ["facade"],
      code: "shipping",
    },
    {
      id: "shippingStore",
      label: "shipping data",
      role: "Shipping private data",
      kind: "object",
      x: 980,
      y: 450,
      width: 160,
      description:
        "Shipping's private store of shipments, keyed by order id, with Shipping's own counter for ship-1, ship-2 and so on.",
      code: "shipping",
    },
    {
      id: "bus",
      label: "InProcessEventBus",
      role: "In-process event bus",
      kind: "class",
      x: 790,
      y: 610,
      width: 200,
      description:
        "A list of OrderPlaced handlers. publish calls each handler synchronously, in subscription order, on the publisher's own call stack: same process, so no network. It has no outbox and stores nothing.",
      patterns: ["pub-sub"],
      code: "eventBus",
    },
  ],
  relations: [
    {
      id: "startCatalog",
      from: "host",
      to: "catalogApi",
      type: "creates",
      label: "start",
      description: "The host starts Catalog first, because Ordering will need it.",
      code: "host",
    },
    {
      id: "startOrdering",
      from: "host",
      to: "orderingApi",
      type: "creates",
      label: "start",
      description:
        "The host starts Ordering second. While its factory runs, Ordering asks the host for CatalogApi, which is allowed because it declared that dependency.",
      code: "host",
    },
    {
      id: "startShipping",
      from: "host",
      to: "shippingApi",
      type: "creates",
      label: "start",
      description:
        "The host starts Shipping last. It declares no dependencies; it subscribes to the bus while it starts.",
      code: "host",
    },
    {
      id: "placeOrder",
      from: "client",
      to: "orderingApi",
      type: "calls",
      label: "placeOrder",
      bend: -90,
      description:
        "The client places an order through Ordering's public API. A rejection comes back as a normal result, not as an exception or an error.",
      code: "ordering",
    },
    {
      id: "getProduct",
      from: "orderingApi",
      to: "catalogApi",
      type: "calls",
      label: "getProduct(sku)",
      bend: -40,
      description:
        "Ordering asks Catalog for a product through CatalogApi. The call is in-process, and what comes back is a ProductInfo, not Catalog's internal record.",
      code: "catalog",
    },
    {
      id: "readCatalog",
      from: "catalogApi",
      to: "catalogStore",
      type: "holds",
      description: "CatalogApi reads and updates the module's own records; nothing else does.",
      code: "catalog",
    },
    {
      id: "saveOrder",
      from: "orderingApi",
      to: "orderingStore",
      type: "holds",
      label: "save copy",
      description:
        "Ordering saves the order with its own copy of each unit price at the moment it was placed.",
      code: "ordering",
    },
    {
      id: "publish",
      from: "orderingApi",
      to: "bus",
      type: "notifies",
      label: "publish",
      description:
        "After saving the order, Ordering publishes an OrderPlaced event on the in-process bus. It does not know who, if anyone, is subscribed.",
      code: "eventBus",
    },
    {
      id: "deliver",
      from: "bus",
      to: "shippingApi",
      type: "notifies",
      label: "OrderPlaced",
      description:
        "The bus calls Shipping's handler synchronously. Shipping depends on the OrderPlaced contract, not on Ordering.",
      code: "shipping",
    },
    {
      id: "saveShipment",
      from: "shippingApi",
      to: "shippingStore",
      type: "holds",
      description: "Shipping's handler records the new shipment in Shipping's own store.",
      code: "shipping",
    },
    {
      id: "setPrice",
      from: "client",
      to: "catalogApi",
      type: "calls",
      label: "setPrice",
      description: "A client reprices a product through Catalog's public API.",
      code: "catalog",
    },
  ],

  steps: [
    {
      title: "One deployable, three modules",
      description:
        "Everything runs in one process and ships as one application, but it is split into three modules: Catalog, Ordering and Shipping. Each has a small public API and its own private data, and the ModuleHost wires them together and enforces which module may use which.",
      highlight: [
        "client",
        "host",
        "catalogApi",
        "catalogStore",
        "orderingApi",
        "orderingStore",
        "shippingApi",
        "shippingStore",
        "bus",
      ],
    },
    {
      title: "The host starts the modules in order",
      description:
        "The host registers Catalog, Ordering and Shipping in that order, and registering a module starts it. Ordering declared catalog as a dependency, so when its factory asks the host for CatalogApi through ctx.use, the host hands it over. Shipping declared none and subscribes to the bus instead.",
      highlight: [
        "host",
        "startCatalog",
        "catalogApi",
        "startOrdering",
        "orderingApi",
        "startShipping",
        "shippingApi",
      ],
      packets: [
        { relation: "startCatalog", label: "start" },
        { relation: "startOrdering", label: "start", after: 0 },
        { relation: "startShipping", label: "start", after: 1 },
      ],
      notes: {
        host: "started: catalog, ordering, shipping",
        orderingApi: "declares: catalog",
        shippingApi: "declares: none",
      },
      code: "host",
    },
    {
      title: "A client places an order",
      description:
        "A client outside the monolith calls OrderingApi.placeOrder for cust-42 with two of sku-1 and one of sku-2. It uses only the public API; the order's data stays inside Ordering.",
      highlight: ["client", "placeOrder", "orderingApi"],
      packets: [{ relation: "placeOrder", label: "placeOrder(cust-42, sku-1×2, sku-2×1)" }],
      notes: { orderingApi: "placeOrder(cust-42, …)" },
      code: "ordering",
    },
    {
      title: "Ordering asks Catalog, in-process",
      description:
        "Ordering calls CatalogApi.getProduct for sku-1 and then for sku-2. Each is an ordinary in-process call that returns a ProductInfo (sku, name, price). Catalog maps its internal record to that type, so the record's supplierCode stays inside the module.",
      highlight: ["orderingApi", "getProduct", "catalogApi", "catalogStore"],
      packets: [
        { relation: "getProduct", label: "getProduct(sku-1)" },
        { relation: "getProduct", label: "ProductInfo", reverse: true, after: 0 },
        { relation: "getProduct", label: "getProduct(sku-2)", after: 1 },
        { relation: "getProduct", label: "ProductInfo", reverse: true, after: 2 },
      ],
      notes: { catalogStore: "supplierCode stays inside" },
      code: "catalog",
    },
    {
      title: "Ordering saves its own copy",
      description:
        "Both products are known, so Ordering totals the lines (2 × 19.99 + 1 × 29.99 = 69.97), assigns the next order id, order-1, and stores the order in its own data together with its own copy of each unit price.",
      highlight: ["orderingApi", "saveOrder", "orderingStore"],
      packets: [{ relation: "saveOrder", label: "save order-1" }],
      notes: { orderingStore: "order-1: 69.97" },
      code: "ordering",
    },
    {
      title: "OrderPlaced reaches Shipping",
      description:
        "Ordering publishes OrderPlaced on the in-process bus. The bus calls Shipping's handler synchronously, on the same call stack, and the handler creates ship-1 with status \"ready to ship\" in Shipping's own data. Only then does placeOrder return the accepted result to the client. Ordering never calls Shipping and Shipping never calls Ordering.",
      highlight: [
        "orderingApi",
        "publish",
        "bus",
        "deliver",
        "shippingApi",
        "saveShipment",
        "shippingStore",
        "placeOrder",
        "client",
      ],
      packets: [
        { relation: "publish", label: "OrderPlaced" },
        { relation: "deliver", label: "OrderPlaced", after: 0 },
        { relation: "saveShipment", label: "create ship-1", after: 1 },
        { relation: "placeOrder", label: "accepted: order-1", reverse: true, after: 2 },
      ],
      notes: { shippingStore: "order-1 → ship-1", bus: "subscribers: 1" },
      code: "shipping",
    },
    {
      title: "An unknown product is rejected",
      description:
        'A second order asks for sku-9. Catalog does not know it, so Ordering returns a rejected result with the reason "unknown product sku-9". It rejects before assigning an id, so nothing is stored in Ordering\'s data and nothing is published on the bus.',
      highlight: ["client", "placeOrder", "orderingApi", "getProduct", "catalogApi"],
      packets: [
        { relation: "placeOrder", label: "placeOrder(cust-42, sku-9×1)" },
        { relation: "getProduct", label: "getProduct(sku-9)", after: 0 },
        { relation: "getProduct", label: "not found", reverse: true, after: 1 },
        {
          relation: "placeOrder",
          label: "rejected: unknown product sku-9",
          reverse: true,
          after: 2,
        },
      ],
      notes: { orderingStore: "still only order-1", bus: "nothing published" },
      code: "ordering",
    },
    {
      title: "Catalog reprices, Ordering keeps its copy",
      description:
        "A client reprices sku-1 to 24.99. Catalog updates only its own record. Ordering is not told and does not need to be: order-1 still totals 69.97, because Ordering computes it from the prices it copied when the order was placed, not from Catalog.",
      highlight: [
        "client",
        "setPrice",
        "catalogApi",
        "readCatalog",
        "catalogStore",
        "orderingStore",
      ],
      packets: [
        { relation: "setPrice", label: "setPrice(sku-1, 24.99)" },
        { relation: "readCatalog", label: "update sku-1", after: 0 },
      ],
      notes: { catalogStore: "sku-1: 24.99", orderingStore: "order-1 still 69.97" },
      code: "catalog",
    },
    {
      title: "The host refuses an undeclared dependency",
      description:
        'To show the boundary check, the usage code asks the host for Catalog on Shipping\'s behalf with use("shipping", "catalog"). Shipping declared no dependencies, so the host refuses with the error "shipping does not declare a dependency on catalog". This lookup check is what an architecture test enforces across the whole codebase in a real project.',
      highlight: ["host", "shippingApi", "catalogApi"],
      notes: {
        host: "shipping → catalog: refused",
        shippingApi: "declares: none",
      },
      code: "host",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: ModularMonolithVisualization,
};
