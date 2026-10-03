/**
 * All three are ways to cut up the same kind of service — an HTTP endpoint that builds an Order,
 * enforces a price invariant, and saves it. They differ in which axis they cut along: by technical
 * layer, by dependency direction, or by feature. Every claim below was checked against
 * `src/architectures/oo/layered`, `src/architectures/oo/hexagonal` and
 * `src/architectures/oo/vertical-slice` (index.ts and all three example files) rather than against
 * the architectures in the abstract.
 */
import type { ComparisonDefinition } from '@/types/comparison'

export const comparison: ComparisonDefinition = {
  slug: 'layered-vs-hexagonal-vs-vertical-slice',
  title: 'Layered vs Hexagonal vs Vertical Slice',
  order: 3,
  summary: 'Three ways to cut up the same service — by technical layer, by dependency direction, or by feature.',
  subjects: [
    { kind: 'architecture', slug: 'layered' },
    { kind: 'architecture', slug: 'hexagonal' },
    { kind: 'architecture', slug: 'vertical-slice' },
  ],
  problem:
    'A service needs to handle incoming requests (place an order, look up an order), run some business rules, and read or write a database — and the team has to decide how to arrange that code so it stays easy to find, change, and test as more requests are added.',
  constraints: [
    'Does the codebase need one agreed rule for "what is allowed to call what", or does each request just need to be easy to find end to end?',
    'How much does the business logic need to be tested in isolation, with no database or framework involved?',
    'Do most requests share the same shape (standard CRUD through one store), or does each request vary wildly in complexity?',
    'Is infrastructure (which database, which framework) expected to change later, or is it settled for the life of the project?',
  ],
  dimensions: [
    {
      label: 'Unit of organisation',
      values: {
        layered: 'A horizontal layer — presentation, application, domain, data access — shared by every request.',
        hexagonal: 'A core (use cases plus domain) versus adapters plugged into ports on its edges, shared by every request.',
        'vertical-slice': 'A slice — one request type, its handler, and its own data access — such as PlaceOrder or GetOrder.',
      },
    },
    {
      label: 'Dependency direction',
      values: {
        layered: 'Downward: OrderController calls OrderService, which calls OrderRepository. The rule is that a layer never skips ahead, but only discipline enforces it, as the controller’s handleDebugLookup shortcut to the database shows.',
        hexagonal: 'Inward: adapters (PostgresOrderRepository, HttpOrderController) depend on the core’s ports; the core — PlaceOrderService and Order — depends on nothing outside itself.',
        'vertical-slice': 'Local to the slice: PlaceOrderHandler calls PlaceOrderStore directly. Beyond its own code, a slice depends only on the shared Mediator pipeline and the shared OrdersTable underneath its store.',
      },
    },
    {
      label: 'Where a new feature’s code goes',
      values: {
        layered: 'Through every layer top to bottom — a new request usually means touching the controller, the service and the repository.',
        hexagonal: 'Into the core, plus a new port and adapter only if it needs new infrastructure the existing ports don’t already cover.',
        'vertical-slice': 'Into one new slice — its own handler and store — registered with the mediator, without editing any other slice.',
      },
    },
    {
      label: 'Testing the business logic without a database',
      values: {
        layered: 'Possible by faking the layer below (a fake OrderRepository passed to OrderService), but nothing structurally forces it.',
        hexagonal: 'Built in: the test harness calls the exact same PlaceOrderUseCase port as the HTTP controller, wired to InMemoryOrderRepository instead of Postgres.',
        'vertical-slice': 'Per slice: PlaceOrderHandler can be tested by swapping PlaceOrderStore, but there’s no shared rule forcing every slice to be written that way.',
      },
    },
    {
      label: 'What’s shared across features',
      values: {
        layered: 'The service and repository layers themselves — OrderService and OrderRepository are reused by whatever requests need "order" logic.',
        hexagonal: 'The core and its ports — PlaceOrderUseCase and OrderRepository are the stable contracts every adapter plugs into.',
        'vertical-slice': 'Only infrastructure: the Mediator, its pipeline behaviours (LoggingBehaviour, ValidationBehaviour) and the physical OrdersTable. PlaceOrder and GetOrder share no handler or store.',
      },
    },
    {
      label: 'Cost for a small CRUD app',
      values: {
        layered: 'Low — the shape almost every backend developer already recognizes, with no extra interfaces to write.',
        hexagonal: 'Higher — ports, driving/driven adapters and wiring are a real tax if infrastructure was never going to change.',
        'vertical-slice': 'Can over-fragment — a handful of closely related, trivial requests may end up as near-duplicate slices instead of one small shared layer.',
      },
    },
  ],
  options: [
    {
      subject: 'layered',
      changes:
        'OrderController, OrderService and OrderRepository are stacked so each only calls the one directly beneath it: handlePlaceOrder delegates the whole "place an order" use case to OrderService, which builds an Order, lets it enforce its own invariant, and hands it to OrderRepository to persist. Neither the controller nor the service builds SQL; only the repository does.',
      chooseWhen: [
        'The team wants a shape every new hire already recognizes, with one simple rule ("only call the layer below you") that code review can enforce by eye.',
        'The application is a fairly standard, data-centric service built around one primary store.',
        'Swapping infrastructure or testing the core in full isolation is not a pressing need right now.',
      ],
      code: [
        { kind: 'architecture', slug: 'layered', region: 'placeOrder' },
        { kind: 'architecture', slug: 'layered', region: 'controller' },
      ],
      steps: [
        { kind: 'architecture', slug: 'layered', step: 0 },
        { kind: 'architecture', slug: 'layered', step: 2 },
      ],
    },
    {
      subject: 'hexagonal',
      changes:
        'PlaceOrderService and Order sit behind a driving port (PlaceOrderUseCase) and call out through a driven port (OrderRepository) that the core itself owns. HttpOrderController and a test harness both call the same driving port; in production OrderRepository is answered by PostgresOrderRepository, while the test wires in InMemoryOrderRepository instead — the core is never touched, mocked or recompiled to make that swap.',
      chooseWhen: [
        'The business logic is valuable enough to deserve millisecond unit tests with no database or framework in the loop.',
        'Infrastructure (the database, the message broker, the UI) is expected to change or be swapped later without rewriting business rules.',
        'Several entry points need to trigger the exact same use case and are expected to behave identically.',
      ],
      code: [
        { kind: 'architecture', slug: 'hexagonal', region: 'repoPort' },
        { kind: 'architecture', slug: 'hexagonal', region: 'inMemory' },
      ],
      steps: [
        { kind: 'architecture', slug: 'hexagonal', step: 0 },
        { kind: 'architecture', slug: 'hexagonal', step: 7 },
      ],
    },
    {
      subject: 'vertical-slice',
      changes:
        'PlaceOrder and GetOrder each get their own handler and their own narrow data-access class (PlaceOrderStore, GetOrderStore) over the same shared table, instead of sharing one OrderService and one OrderRepository. A Mediator routes each request to the one handler registered for it, through a pipeline (LoggingBehaviour, ValidationBehaviour) that wraps every slice the same way without either slice’s handler knowing it is there.',
      chooseWhen: [
        'Shared service and repository classes have accumulated methods that only one feature actually uses, and changes keep rippling sideways.',
        'Features vary enormously in complexity, and forcing a trivial one through the same stack as a complex one wastes effort.',
        'Teams are organized around features rather than technical layers, and want the code to match.',
      ],
      code: [
        { kind: 'architecture', slug: 'vertical-slice', region: 'placeOrderHandler' },
        { kind: 'architecture', slug: 'vertical-slice', region: 'getOrderHandler' },
      ],
      steps: [
        { kind: 'architecture', slug: 'vertical-slice', step: 0 },
        { kind: 'architecture', slug: 'vertical-slice', step: 4 },
      ],
    },
  ],
  noPattern: {
    when: 'A handful of CRUD endpoints over one table, built by one or two developers, with no plan to swap the database and no business rule complex enough to need isolated unit tests.',
    instead:
      'A single file (or one file per endpoint) that validates the request and calls the database directly is enough. Reach for Layered once "what calls what" stops being obvious; for Hexagonal once the business rules need testing without infrastructure, or infrastructure is genuinely expected to change; for Vertical Slice once shared service/repository classes start accumulating feature-specific methods that only one caller needs.',
  },
  overlap:
    'These are not mutually exclusive cuts of the same codebase — they answer different questions and are routinely combined. A vertical slice can be layered internally (PlaceOrderHandler could itself delegate to a small domain object and a repository, instead of calling PlaceOrderStore directly), and a hexagonal core’s ports can live inside a slice rather than at the top of a shared stack — each slice gets its own driving and driven ports instead of one shared OrderRepository interface for the whole app. Hexagonal itself is usually read as Layered with its bottom dependency inverted: the same request still flows presentation → application → domain → data on the way in, but the arrow between domain and data access is flipped so the core owns the interface instead of depending on a concrete repository.',
  scenario: {
    prompt:
      'A team is building an order-management service. It already has PlaceOrder and GetOrder, expects to keep adding narrowly-scoped requests (CancelOrder, RefundOrder, …) that share almost no code with each other, and wants the pricing and refund rules inside each of those requests to be unit-testable without spinning up a database. Which fits best?',
    choices: [
      {
        id: 'vertical-slice',
        option: 'vertical-slice',
        label: 'Vertical Slice — one slice per request, each with its own handler and store',
        verdict: 'best',
        explanation:
          'The requests are expected to keep growing in number and barely share code, which is exactly the shape Vertical Slice is for: each new request becomes its own slice, registered with the mediator, without touching PlaceOrder’s or GetOrder’s handler or store. Nothing stops a slice from putting its own pricing logic behind a small port internally for testability, which covers the per-slice unit-testing need too.',
      },
      {
        id: 'hexagonal',
        option: 'hexagonal',
        label: 'Hexagonal — one core with ports, shared by every request',
        verdict: 'workable',
        explanation:
          'Hexagonal would satisfy the "test the rules without a database" constraint directly, the way the InMemoryOrderRepository swap does here — but it says nothing about requests barely sharing code, and a single shared core with shared ports starts fighting the "add narrowly-scoped requests independently" constraint as CancelOrder and RefundOrder pile up.',
      },
      {
        id: 'layered',
        option: 'layered',
        label: 'Layered — one shared presentation/application/domain/data-access stack',
        verdict: 'poor',
        explanation:
          'A shared OrderService and OrderRepository would have to grow a method for every new, barely-related request, which is the exact accumulation problem the team is trying to avoid — and nothing in Layered forces the domain layer to be testable without the data-access layer underneath it.',
      },
      {
        id: 'none',
        option: 'none',
        label: 'No named architecture — one script per endpoint',
        verdict: 'poor',
        explanation:
          'This might be fine for a single CRUD endpoint, but a growing set of requests that each need isolated, testable business rules is well past where ad hoc scripts stay manageable — with no shared pipeline, every script would reimplement its own logging and validation.',
      },
    ],
  },
}
