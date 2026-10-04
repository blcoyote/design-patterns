/**
 * All three are ways to cut up the same kind of service — an HTTP endpoint that builds an Order,
 * enforces a price invariant, and saves it. They differ in which axis they cut along: by technical
 * layer, by dependency direction, or by feature. Every claim below was checked against
 * `src/architectures/oo/layered`, `src/architectures/oo/hexagonal` and
 * `src/architectures/oo/vertical-slice` (index.ts and all four language examples) rather than against
 * the architectures in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "layered-vs-hexagonal-vs-vertical-slice",
  title: "Layered vs Hexagonal vs Vertical Slice",
  order: 3,
  summary:
    "Three ways to cut up the same service — by technical layer, by dependency direction, or by feature.",
  subjects: [
    { kind: "architecture", slug: "layered" },
    { kind: "architecture", slug: "hexagonal" },
    { kind: "architecture", slug: "vertical-slice" },
  ],
  problem:
    "A service needs to handle incoming requests (place an order, look up an order), run some business rules, and read or write a database — and the team has to decide how to arrange that code so it stays easy to find, change, and test as more requests are added.",
  constraints: [
    'Does the codebase need one agreed rule for "what is allowed to call what", or does each request just need to be easy to find end to end?',
    "How much does the business logic need to be tested in isolation, with no database or framework involved?",
    "Do most requests share the same shape (standard CRUD through one store), or does each request vary wildly in complexity?",
    "Is infrastructure (which database, which framework) expected to change later, or is it settled for the life of the project?",
  ],
  dimensions: [
    {
      label: "Unit of organisation",
      values: {
        layered:
          "A horizontal layer — presentation, application, domain, data access — shared by every request.",
        hexagonal:
          "A core (use cases plus domain) versus adapters plugged into ports on its edges, shared by every request.",
        "vertical-slice":
          "A slice — one request type, its handler, and its own data access — such as PlaceOrder or GetOrder.",
      },
    },
    {
      label: "Dependency direction",
      values: {
        layered:
          "Downward: OrderController calls OrderService, which calls Order and OrderRepository. The rule is that a layer may call only layers below it, never above (data access still uses the domain's Order type to map rows), and only the data-access layer talks to the database, but only discipline enforces it, as the controller’s handleDebugLookup shortcut to the database shows.",
        hexagonal:
          "Inward: adapters (PostgresOrderRepository, HttpOrderController) depend on the core’s ports; the core — PlaceOrderService and Order — depends on nothing outside itself.",
        "vertical-slice":
          "Local to the slice: PlaceOrderHandler calls PlaceOrderStore directly. Beyond its own code, a slice depends only on the shared Mediator pipeline and the shared OrdersTable underneath its store.",
      },
    },
    {
      label: "Where a new feature’s code goes",
      values: {
        layered:
          "Through every layer top to bottom — a new request usually means touching the controller, the service and the repository.",
        hexagonal:
          "Into the core, plus a new driving port (a use-case interface) and its adapter route; a new driven port and adapter only if it needs infrastructure the existing ones don’t already cover.",
        "vertical-slice":
          "Into one new slice — its own handler and store — registered with the mediator, without editing any other slice.",
      },
    },
    {
      label: "Testing the business logic without a database",
      values: {
        layered:
          "Possible by faking the layer below (a fake OrderRepository passed to OrderService), but nothing structurally forces it.",
        hexagonal:
          "Built in: the test harness calls the exact same PlaceOrderUseCase port as the HTTP controller, wired to InMemoryOrderRepository instead of Postgres.",
        "vertical-slice":
          "Per slice: PlaceOrderHandler can be tested by swapping PlaceOrderStore, but there’s no shared rule forcing every slice to be written that way.",
      },
    },
    {
      label: "What’s shared across features",
      values: {
        layered:
          'The service and repository layers themselves — OrderService and OrderRepository are reused by whatever requests need "order" logic.',
        hexagonal:
          "The core and its ports — PlaceOrderUseCase and OrderRepository are the stable contracts every adapter plugs into.",
        "vertical-slice":
          "Only infrastructure: the Mediator, its pipeline behaviours (LoggingBehaviour, ValidationBehaviour) and the physical OrdersTable. PlaceOrder and GetOrder share no handler or store.",
      },
    },
    {
      label: "Cost for a small CRUD app",
      values: {
        layered:
          "Low — the shape almost every backend developer already recognizes, with few or no extra interfaces to write.",
        hexagonal:
          "Higher — ports, driving/driven adapters and wiring are a real tax if infrastructure was never going to change.",
        "vertical-slice":
          "Can over-fragment — a handful of closely related, trivial requests may end up as near-duplicate slices instead of one small shared layer.",
      },
    },
  ],
  options: [
    {
      subject: "layered",
      changes:
        "OrderController passes the request to OrderService, which builds and validates the Order, then saves it through OrderRepository. Each part calls only layers below it, never above; only the repository builds SQL.",
      chooseWhen: [
        'The team wants a shape every new hire already recognizes, with one simple rule ("only call layers below you, never above") that code review can enforce by eye.',
        "The application is a fairly standard, data-centric service built around one primary store.",
        "Swapping infrastructure or testing the core in full isolation is not a pressing need right now.",
      ],
      code: [
        { kind: "architecture", slug: "layered", region: "placeOrder" },
        { kind: "architecture", slug: "layered", region: "controller" },
      ],
      steps: [
        { kind: "architecture", slug: "layered", step: 0 },
        { kind: "architecture", slug: "layered", step: 2 },
      ],
    },
    {
      subject: "hexagonal",
      changes:
        "PlaceOrderService and Order sit in the core. The core defines a PlaceOrderUseCase port for callers and an OrderRepository port for data access. In production, PostgresOrderRepository implements that port; tests use InMemoryOrderRepository instead. The same core works with either one.",
      chooseWhen: [
        "The business logic is valuable enough to deserve millisecond unit tests with no database or framework in the loop.",
        "Infrastructure (the database, the message broker, the UI) is expected to change or be swapped later without rewriting business rules.",
        "Several entry points need to trigger the exact same use case and are expected to behave identically.",
      ],
      code: [
        { kind: "architecture", slug: "hexagonal", region: "repoPort" },
        { kind: "architecture", slug: "hexagonal", region: "inMemory" },
      ],
      steps: [
        { kind: "architecture", slug: "hexagonal", step: 0 },
        { kind: "architecture", slug: "hexagonal", step: 7 },
      ],
    },
    {
      subject: "vertical-slice",
      changes:
        "PlaceOrder and GetOrder each have their own handler and data-access class, even though they use the same table. A Mediator sends each request to its handler. A shared pipeline adds logging and validation around every handler, so slices do not need to know about that shared behavior.",
      chooseWhen: [
        "Shared service and repository classes have accumulated methods that only one feature actually uses, and changes keep rippling sideways.",
        "Features vary enormously in complexity, and forcing a trivial one through the same stack as a complex one wastes effort.",
        "Teams are organized around features rather than technical layers, and want the code to match.",
      ],
      code: [
        {
          kind: "architecture",
          slug: "vertical-slice",
          region: "placeOrderHandler",
        },
        {
          kind: "architecture",
          slug: "vertical-slice",
          region: "getOrderHandler",
        },
      ],
      steps: [
        { kind: "architecture", slug: "vertical-slice", step: 0 },
        { kind: "architecture", slug: "vertical-slice", step: 4 },
      ],
    },
  ],
  noPattern: {
    when: "A handful of CRUD endpoints over one table, built by one or two developers, with no plan to swap the database and no business rule complex enough to need isolated unit tests.",
    instead:
      "Start with one file, or one file per endpoint, that validates the request and calls the database. Add Layered when it becomes unclear what should call what. Use Hexagonal when business rules need isolated tests or the infrastructure may change. Use Vertical Slice when shared services and repositories collect methods used by only one feature.",
  },
  overlap:
    "These architectures answer different questions and can be combined. A vertical slice can use layers inside each request. A hexagonal core can sit inside a slice, with ports for that feature. Hexagonal can also look like Layered, but the dependency points inward: the domain owns the data-access interface, and the database adapter implements it.",
  scenario: {
    prompt:
      "A team already has PlaceOrder and GetOrder and expects to add more requests that share little code. It also wants to test pricing and refund rules without a database. Which architecture fits best?",
    choices: [
      {
        id: "vertical-slice",
        option: "vertical-slice",
        label: "Vertical Slice — one slice per request, each with its own handler and store",
        verdict: "best",
        explanation:
          "Each new request gets its own slice, so adding one does not change PlaceOrder or GetOrder. The Mediator routes requests to their slices. A slice can still put its pricing rules behind a small interface, so tests do not need a database.",
      },
      {
        id: "hexagonal",
        option: "hexagonal",
        label: "Hexagonal — one core with ports, shared by every request",
        verdict: "workable",
        explanation:
          "Hexagonal makes the rules testable without a database, as the InMemoryOrderRepository example shows. But it does not say how to organize requests that share little code. A shared core and shared ports may grow as those requests are added.",
      },
      {
        id: "layered",
        option: "layered",
        label: "Layered — one shared presentation/application/domain/data-access stack",
        verdict: "poor",
        explanation:
          "A shared OrderService and OrderRepository would collect methods for unrelated requests, the problem the team wants to avoid. Layered also does not require the business rules to be testable without the data-access layer.",
      },
      {
        id: "none",
        option: "none",
        label: "No named architecture — one script per endpoint",
        verdict: "poor",
        explanation:
          "One script may be enough for a single simple endpoint. With many requests and business rules to test, scripts become harder to manage and each one would need its own logging and validation.",
      },
    ],
  },
};
