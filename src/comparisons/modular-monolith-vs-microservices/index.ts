/**
 * Modular Monolith and Microservices draw the same kind of boundary (a module or service with
 * a small public interface and private data) and differ in how that boundary is crossed: an
 * in-process call inside one deployable, or a remote call between separate deployables. Every
 * claim below was checked against `src/architectures/both/modular-monolith` and
 * `src/architectures/both/microservices` (index.ts and all four language examples), not against
 * the two styles in the abstract. Both examples run as a single program: the Microservices
 * "services" are objects that stand in for separate processes, and the claims below say so.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "modular-monolith-vs-microservices",
  title: "Modular Monolith vs Microservices",
  order: 6,
  summary:
    "The same module boundaries, two price tags: in-process calls inside one deployable, or network calls between separate deployables.",
  subjects: [
    { kind: "architecture", slug: "modular-monolith" },
    { kind: "architecture", slug: "microservices" },
  ],
  problem:
    "An order platform has grown past one undivided codebase. Catalog, ordering, payments and shipping are tangled together, and teams keep breaking each other. Both styles cut the system along the same seams with private data behind a small interface; the question is whether those seams are crossed inside one running application or between separate services.",
  constraints: [
    "Do the parts really need to be deployed, scaled or restarted on their own, or is one release of the whole application acceptable?",
    "Can one part’s failure be allowed to affect the others, or must it be contained at a boundary the team has to build and operate?",
    "How much does a call between parts have to cope with: a plain function call, or a call that can be slow, fail or never arrive?",
    "Do separate teams need to own their part, data and release schedule end to end, or can they share one codebase and build?",
    "Are the boundaries already well understood, or are they still moving? Moving a line is cheaper inside one codebase than across services.",
  ],
  dimensions: [
    {
      label: "Deployment",
      values: {
        "modular-monolith":
          "One deployable application and one process: ModuleHost starts Catalog, Ordering and Shipping inside it, and one release carries every module’s changes.",
        microservices:
          "Each service is meant to be deployed, scaled and restarted on its own, with an ApiGateway as the one address clients know. The example itself runs the services as objects in one program that stand in for separate processes.",
      },
    },
    {
      label: "Data ownership",
      values: {
        "modular-monolith":
          "Each module has a private store (Catalog’s records, Ordering’s orders, Shipping’s shipments) that only its own code touches. Ordering keeps its own copy of each unit price, so repricing in Catalog does not change an order already placed. In a real system the stores can share one database server as long as each module owns separate tables or a schema.",
        microservices:
          "Services own their data and nothing reads another service’s store. In the example, Inventory keeps a private product catalog and Orders a private store of the orders it recorded. Payments keeps no data of its own, only a call counter and a down flag, and Shipping holds only the list of OrderPlaced events it received.",
      },
    },
    {
      label: "Failure isolation",
      values: {
        "modular-monolith":
          "Modules share one process, so a crash or runaway code path in one module affects them all. The in-process bus calls Shipping’s handler on the publisher’s own call stack, with nothing around the handler, so Ordering’s call to place an order does not return until that handler has run.",
        microservices:
          "A failing service can be contained at its boundary, but the caller has to build that containment. The example wraps only the Payments call in a CircuitBreaker: after three failures in a row it opens, and the next charge fails without reaching PaymentsService, whose call count stays at 4. The Inventory lookup has no breaker.",
      },
    },
    {
      label: "Cost of a call between parts",
      values: {
        "modular-monolith":
          "An ordinary in-process call: Ordering asks CatalogApi for a product and gets a ProductInfo back. There is no client proxy, cache or circuit breaker, because the call cannot fail like a network call.",
        microservices:
          "A remote call that the caller must plan for. Orders reaches Inventory through InventoryServiceClient, which caches lookups and translates Inventory’s ProductDto into Orders’ own Product model, and reaches Payments through the CircuitBreaker. In the example these are plain method calls, so the code shows what a network forces on the caller, not an actual network.",
      },
    },
    {
      label: "Team independence",
      values: {
        "modular-monolith":
          "Teams share one codebase and one build. Boundaries hold only while something enforces them: here ModuleHost refuses a lookup of an undeclared module, and in a real codebase an architecture test or the compiler would. API changes between modules need an agreed process.",
        microservices:
          "A team can own a service end to end, including its data and release schedule, and rewrite it so long as its interface stays the same. In the example Inventory’s ProductDto can change shape without Orders’ Product model changing, because the client translates it. The price is versioned contracts, deployment pipelines and monitoring for every service.",
      },
    },
    {
      label: "Changing your mind later",
      values: {
        "modular-monolith":
          "A module with a narrow API and private data is the natural unit to extract into a service. The in-process call then becomes a remote one, which has to cope with network failure.",
        microservices:
          "The Microservices page lists the modular monolith as a variant: a destination in its own right or a stepping stone before a module is pulled out.",
      },
    },
  ],
  options: [
    {
      subject: "modular-monolith",
      changes:
        "Catalog, Ordering and Shipping stay in one application, but each exposes only a small public API and keeps its own private store. Ordering calls CatalogApi in-process and gets a ProductInfo back, and learns nothing of Catalog’s internal record. Shipping hears about orders from an OrderPlaced event on the in-process bus. ModuleHost starts the modules and refuses a lookup of a module the requester did not declare.",
      chooseWhen: [
        "You want clear boundaries between parts of the domain, but the team, the load or the release cadence do not (yet) justify separate services.",
        "The boundaries are still being discovered, and moving a line inside one codebase is much cheaper than moving it across services.",
        "You want one deployment and in-process calls, with the operational simplicity of a single application.",
        "You expect that a module may one day become a service, and want its API and data ownership ready for that.",
      ],
      code: [
        { kind: "architecture", slug: "modular-monolith", region: "ordering" },
        { kind: "architecture", slug: "modular-monolith", region: "host" },
        { kind: "architecture", slug: "modular-monolith", region: "eventBus" },
      ],
      steps: [
        { kind: "architecture", slug: "modular-monolith", step: 3 },
        { kind: "architecture", slug: "modular-monolith", step: 5 },
        { kind: "architecture", slug: "modular-monolith", step: 8 },
      ],
    },
    {
      subject: "microservices",
      changes:
        "Orders, Inventory and Payments become separate services that meet only through explicit interfaces. Orders reaches Inventory through InventoryServiceClient (a cache plus a translation of Inventory’s DTO) and wraps every Payments call in a CircuitBreaker. It publishes OrderPlaced through the MessageBroker only for a paid order. In this example the services are objects in one program that stand in for separate processes.",
      chooseWhen: [
        "Different parts of the system genuinely need to scale, deploy or fail independently of each other.",
        "Separate teams need to own separate services end to end, including their own data stores and release schedules.",
        "The domain already splits cleanly into independent subdomains worth deploying on their own.",
        "The organization can afford the operational cost of running many services instead of one: pipelines, monitoring, service discovery and versioned contracts.",
      ],
      code: [
        { kind: "architecture", slug: "microservices", region: "inventoryClient" },
        { kind: "architecture", slug: "microservices", region: "breaker" },
        { kind: "architecture", slug: "microservices", region: "orders" },
      ],
      steps: [
        { kind: "architecture", slug: "microservices", step: 3 },
        { kind: "architecture", slug: "microservices", step: 7 },
        { kind: "architecture", slug: "microservices", step: 8 },
      ],
    },
  ],
  noPattern: {
    when: "The system is small, one team owns all of it, and nothing yet pulls the parts apart. Nobody is tripping over another part’s data, and a single release is fine.",
    instead:
      "Keep one ordinary application with sensible packages or folders. Add enforced module boundaries when coupling starts to hurt, and consider separate services only when a specific part needs to scale, deploy or fail on its own.",
  },
  overlap:
    "These are two ways to cross the same boundary, not rival boundaries. On the Modular Monolith page, Catalog, Ordering and Shipping keep the same ones that Orders, Inventory and Payments have on the Microservices page: each owns whatever data it keeps, access only through an API, and OrderPlaced as the only coupling. They can be combined: a system can stay a modular monolith and run a module or two as separate services once that module needs it. “Start with a modular monolith and extract services later” is a common piece of advice and a reasonable default when the boundaries are not yet clear and no team or scaling pressure forces the split, but it is a judgement, not a rule. Some systems have such pressure from the start, and a monolith whose boundaries are not enforced is hard to split later.",
  scenario: {
    prompt:
      "Two teams are building an order platform with Catalog, Ordering and Shipping parts. Traffic is modest, one weekly release suits everyone, and the team is still arguing about where some responsibilities belong. A colleague proposes three services from day one “so we scale later”. What should the team choose?",
    choices: [
      {
        id: "modular-monolith",
        option: "modular-monolith",
        label:
          "One deployable application with enforced module boundaries, each module owning its data",
        verdict: "best",
        explanation:
          "The team wants clear boundaries, not independent scaling or release, and the boundaries are still moving. Inside one codebase, a module call is an ordinary call that needs no cache or circuit breaker, and moving a responsibility is a refactor. Private data and a narrow API per module keep the option of extracting a service later open.",
      },
      {
        id: "microservices",
        option: "microservices",
        label: "Separate Catalog, Ordering and Shipping services from the start",
        verdict: "poor",
        explanation:
          "Nothing described needs services: no part has to scale or fail separately, and the release cadence is shared. The team would take on remote calls that can be slow or fail, consistency spread across services, and pipelines and monitoring for each, while still unsure where the boundaries belong. Redrawing a service boundary is then far more costly than moving code between modules.",
      },
      {
        id: "unenforced",
        label: "One application, but modules may read each other’s tables to move faster",
        verdict: "poor",
        explanation:
          "This keeps the single deployable but drops the part that makes it modular. Shared tables are how one team’s schema change breaks another’s query. In the Modular Monolith example, Ordering reaches Catalog only through CatalogApi and keeps its own copy of the price at placement, and ModuleHost refuses a lookup of an undeclared module.",
      },
      {
        id: "no-structure",
        option: "none",
        label: "One application with no module boundaries; sort it out later",
        verdict: "workable",
        explanation:
          "For one small team this can be fine for a while. With two teams already disagreeing about where responsibilities belong, though, any class can call any other, and untangling it later is harder than drawing the boundaries now.",
      },
    ],
  },
};
