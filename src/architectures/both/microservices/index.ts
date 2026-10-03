import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MicroservicesVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "microservices",
  name: "Microservices",
  paradigm: "both",
  order: 9,
  summary:
    "Split a system into independently deployable services, each owning its own data, that talk only through explicit client and message interfaces.",
  intent:
    "Build the system as a set of small, independently deployable services, each owning its own data store and exposed only through an explicit interface — a synchronous client call or an asynchronous message. No service reaches into another's database, and no service assumes another is even written in the same language.",
  problem:
    "A single large application eventually couples everything to everything: one team's schema change breaks another team's query, one slow code path drags down the whole process, and the entire system has to be deployed together even when only one small part changed. Scaling means scaling the whole monolith, not just the part under load, and a single unhandled failure can take the whole process down with it.",
  solution:
    "Carve the system along its natural seams — Orders, Inventory, Payments — into separate services, each with its own private data store that nothing outside it touches directly. Services call each other through explicit client interfaces (a proxy that stands in for the remote call) or by publishing and subscribing to messages, never by sharing a table. An API Gateway gives outside callers one simple entry point instead of making them track every service's address. Because a remote call can fail in ways a local call cannot, callers wrap risky calls in resilience patterns — a circuit breaker that stops hammering a dependency that is already down, a cache that avoids calling it at all for data that rarely changes.",
  analogy:
    "A shopping mall instead of one department store under a single roof. Each shop (service) keeps its own till and its own stockroom (its own data), and none of them can reach behind another shop's counter. A shopper enters through the mall directory (API Gateway) rather than learning every shop's back entrance, and if one shop's card reader is down, the mall does not grind to a halt — that one shop just stops taking payments until it is fixed.",
  whenToUse: [
    "Different parts of the system genuinely need to scale, deploy, or fail independently of each other.",
    "Separate teams need to own separate services end to end, including their own data stores and release schedules.",
    "The domain already splits cleanly into independent subdomains or bounded contexts worth deploying on their own.",
    "The organization can afford the operational cost — service discovery, monitoring, deployment pipelines — that comes with running many small services instead of one.",
  ],
  pros: [
    "Each service can be deployed, scaled and restarted independently, so a spike in order volume does not require scaling Inventory or Payments too.",
    "A failure in one service — Payments going down — can be contained at the boundary instead of taking the whole system down with it.",
    "Teams can own a service end to end, including its own data store, and release it on their own schedule.",
    "Services can evolve or even be rewritten independently, as long as the interface they expose to callers stays the same.",
  ],
  cons: [
    "What used to be an in-process function call is now a remote call that can be slow, partially fail, or not arrive at all — every caller has to plan for that.",
    "Data that used to live in one table and one transaction is now spread across services, so consistency across them has to be designed for explicitly instead of assumed.",
    "Operating many small services — deployment pipelines, monitoring, service discovery, versioned contracts — costs real effort that a single deployable application never pays.",
    "Tracing one user action across several services, and debugging it when something goes wrong, is harder than stepping through one process in a debugger.",
  ],
  realWorld: [
    "Netflix and Amazon are the canonical examples of large organizations that decompose their systems into hundreds of independently deployed services.",
    "E-commerce platforms routinely split Orders, Inventory, Payments and Shipping into separate services, each with its own database, connected through an API Gateway and an event bus.",
    "Kubernetes-based platforms pair microservices with a service mesh (Istio, Linkerd) so that retries, timeouts and circuit breaking live in a sidecar instead of being re-implemented in every service.",
    "Cloud API gateways (Amazon API Gateway, Azure API Management, Kong) exist specifically to give a fleet of backend services one public entry point.",
  ],
  concepts: [
    {
      term: "Service",
      description:
        "An independently deployable unit with its own private data store. Other services can reach its data only through the interface it exposes, never through its database directly.",
    },
    {
      term: "API Gateway",
      description:
        "A single entry point for outside callers that routes to the right backend service, so a client never has to know every service's address.",
    },
    {
      term: "Service Client",
      description:
        "A local object that stands in for a remote service behind the same interface a caller would use for a local call, hiding the fact that a call might cross a process boundary.",
    },
    {
      term: "Read-Through Cache",
      description:
        "A cache a service client checks before calling the remote service, populated on a miss so a repeated lookup for the same key does not cross the boundary again.",
    },
    {
      term: "Circuit Breaker",
      description:
        "A guard in front of a remote call that trips open after repeated failures, so further calls fail immediately instead of waiting on a dependency that is already down.",
    },
    {
      term: "Message Broker",
      description:
        "A channel services publish events to and subscribe to events from, so a publisher never needs to know which services, if any, are listening.",
    },
    {
      term: "Integration Event",
      description:
        "A message like OrderPlaced that announces something happened in one service, in a shape meant for other services to consume — not the publisher's own internal model.",
    },
  ],
  variants: [
    {
      name: "Service mesh / sidecar",
      description:
        "Retries, timeouts, circuit breaking and service discovery move out of each service's own code into a sidecar proxy deployed next to it, so every service gets the same resilience behaviour without re-implementing it.",
    },
    {
      name: "Modular monolith",
      description:
        "A single deployable application internally split into modules with the same strict boundaries — no shared tables, calls only through an explicit interface — as a deliberate stepping stone before any module is pulled out into its own service.",
    },
    {
      name: "Synchronous vs. asynchronous integration",
      description:
        "Services can integrate by calling each other directly and waiting for a response (as Orders calls Inventory and Payments here), or by publishing and subscribing to events (as Orders announces OrderPlaced). Most real systems use both, depending on whether the caller needs an answer right away.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "facade",
        why: "ApiGateway is the one simple entry point a client calls; behind it sit three separate services the client never has to address individually.",
      },
      {
        slug: "proxy",
        why: "InventoryServiceClient stands in for the remote Inventory service behind the exact same getProduct interface Orders would use for a local call.",
      },
      {
        slug: "circuit-breaker",
        why: "CircuitBreaker wraps every call to PaymentsService.charge; after three failures in a row it opens, and the next charge fails fast without PaymentsService ever being called.",
      },
      {
        slug: "cache-aside",
        why: "InventoryServiceClient checks its own cache first; on a miss it calls InventoryService.findProduct and populates the cache, so a repeated lookup for the same sku never reaches Inventory again.",
      },
      {
        slug: "adapter",
        why: "InventoryServiceClient converts Inventory's own ProductDto (sku, displayName, unitPriceCents) into Orders' own Product model (sku, name, price), so Inventory's wire shape never reaches OrderService.",
      },
      {
        slug: "pub-sub",
        why: "OrderService publishes OrderPlaced to MessageBroker only once a payment succeeds; ShippingService subscribes to it without OrderService ever knowing Shipping exists.",
      },
    ],
    architectures: [
      {
        slug: "ddd",
        why: "One microservice per bounded context is the usual way to cut a system — Orders, Inventory and Payments here each keep their own model and their own data.",
      },
      {
        slug: "hexagonal",
        why: "Each service is internally a hexagon of its own: PaymentsService and InventoryService sit at the core, and the clients that call them from other services are driven adapters from the caller's point of view.",
      },
      {
        slug: "event-driven",
        why: "OrderService publishing OrderPlaced instead of calling Shipping directly is the same integration style Event-Driven Architecture generalizes to an entire system.",
      },
      {
        slug: "cqrs",
        why: "A service that only needs to answer queries can build its own read model from other services' events instead of calling them synchronously on every request.",
      },
    ],
  },

  viewBox: "0 0 1100 700",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 550,
      y: 40,
      description:
        "A caller outside the system — a web or mobile app. It knows only the API Gateway's address, never any individual service's.",
    },
    {
      id: "gateway",
      label: "ApiGateway",
      role: "API Gateway",
      kind: "class",
      x: 550,
      y: 140,
      width: 170,
      description:
        "The one entry point clients see. It forwards placeOrder straight to the Orders service and has no business logic of its own.",
      patterns: ["facade"],
    },
    {
      id: "orders",
      label: "OrderService",
      role: "Orders service",
      kind: "class",
      x: 270,
      y: 240,
      width: 170,
      description:
        "Orchestrates one use case: price every line through its Inventory client, charge the customer through its Payments breaker, record the result in its own private store of orders, and publish OrderPlaced only when payment succeeded.",
    },
    {
      id: "inventoryClient",
      label: "InventoryServiceClient",
      role: "Service client (in Orders)",
      kind: "class",
      x: 150,
      y: 400,
      width: 190,
      description:
        "Orders' own stand-in for the Inventory service. It checks a cache before calling out, and translates Inventory's DTO into Orders' own Product model.",
      patterns: ["proxy", "cache-aside", "adapter"],
    },
    {
      id: "paymentsBreaker",
      label: "CircuitBreaker",
      role: "Resilience wrapper (in Orders)",
      kind: "class",
      x: 400,
      y: 400,
      width: 170,
      description:
        "Wraps every call Orders makes to Payments. After three failures in a row it opens, so the next attempt fails immediately instead of calling Payments again.",
      patterns: ["circuit-breaker"],
    },
    {
      id: "inventory",
      label: "InventoryService",
      role: "Inventory service",
      kind: "class",
      x: 675,
      y: 260,
      width: 170,
      description:
        "Its own process with its own private product catalog. Nothing outside it ever reads that catalog directly — only through findProduct.",
    },
    {
      id: "payments",
      label: "PaymentsService",
      role: "Payments service",
      kind: "class",
      x: 945,
      y: 260,
      width: 170,
      description:
        "Its own process, reachable only through charge(). In this scenario it is down, so every charge it receives fails.",
    },
    {
      id: "broker",
      label: "MessageBroker",
      role: "Message broker",
      kind: "class",
      x: 550,
      y: 600,
      width: 170,
      description:
        "A plain publish/subscribe channel. OrderService publishes to it without knowing who, if anyone, is subscribed.",
      patterns: ["pub-sub"],
    },
    {
      id: "shipping",
      label: "ShippingService",
      role: "Shipping service",
      kind: "class",
      x: 830,
      y: 600,
      width: 170,
      description:
        "Learns about a new order only by subscribing to the broker. It has never heard of OrderService and never calls it back.",
    },
  ],
  relations: [
    {
      id: "toGateway",
      from: "client",
      to: "gateway",
      type: "calls",
      label: "placeOrder(lines)",
      description: "The client calls the one address it knows: the API Gateway.",
      code: "gateway",
    },
    {
      id: "toOrders",
      from: "gateway",
      to: "orders",
      type: "calls",
      label: "placeOrder(command)",
      description: "The gateway assigns an order id and forwards straight to the Orders service.",
      code: "orders",
    },
    {
      id: "toInventoryClient",
      from: "orders",
      to: "inventoryClient",
      type: "calls",
      label: "getProduct(sku)",
      description:
        "Orders asks its own Inventory client for a product, the same call whether it will be a cache hit or a miss.",
      code: "inventoryClient",
    },
    {
      id: "toInventory",
      from: "inventoryClient",
      to: "inventory",
      type: "calls",
      label: "findProduct(sku)",
      description:
        "Only on a cache miss does the client actually reach across to the Inventory service.",
      code: "inventory",
    },
    {
      id: "toBroker",
      from: "orders",
      to: "broker",
      type: "notifies",
      label: "publish(OrderPlaced)",
      description:
        "Only a paid order is announced: once payment succeeds, Orders publishes OrderPlaced. A failed order is recorded in Orders' own store but never reaches the broker.",
      code: "orders",
    },
    {
      id: "toShipping",
      from: "broker",
      to: "shipping",
      type: "notifies",
      label: "onOrderPlaced(event)",
      description:
        "The broker forwards the event to every subscriber. Shipping is the only one in this scenario.",
      code: "shipping",
    },
    {
      id: "toBreaker",
      from: "orders",
      to: "paymentsBreaker",
      type: "calls",
      label: "call(() => charge)",
      description:
        "Orders never calls Payments directly — every attempt goes through its circuit breaker first.",
      code: "breaker",
    },
    {
      id: "toPayments",
      from: "paymentsBreaker",
      to: "payments",
      type: "calls",
      label: "charge(orderId, total)",
      description:
        "While the breaker is closed, it forwards the call straight through to Payments.",
      code: "payments",
    },
  ],

  steps: [
    {
      title: "Three services, one gateway",
      description:
        "Orders, Inventory and Payments are three separate services, each with its own private data. The only way in from outside is the API Gateway; the only ways across, from inside, are an explicit service client call or a message on the broker.",
      highlight: [
        "client",
        "gateway",
        "orders",
        "inventoryClient",
        "paymentsBreaker",
        "inventory",
        "payments",
        "broker",
        "shipping",
      ],
    },
    {
      title: "A client places an order through the gateway",
      description:
        "The client calls ApiGateway.placeOrder with two line items for the same product. The gateway assigns the order id order-1 and forwards the command — it has no business logic of its own.",
      highlight: ["client", "toGateway", "gateway"],
      packets: [{ relation: "toGateway", label: "placeOrder(lines)" }],
      notes: { gateway: "assigns order-1" },
      code: "gateway",
    },
    {
      title: "The gateway forwards to the Orders service",
      description:
        "OrderService.placeOrder starts pricing the order by asking its Inventory client for each line item in turn.",
      highlight: ["gateway", "toOrders", "orders"],
      packets: [{ relation: "toOrders", label: "placeOrder(command)" }],
      notes: { orders: "pricing order-1" },
      code: "orders",
    },
    {
      title: "The first lookup is a cache miss",
      description:
        "InventoryServiceClient has nothing cached for sku-1 yet, so it calls InventoryService.findProduct, adapts the returned DTO into Orders' own Product model, and caches it.",
      highlight: ["orders", "toInventoryClient", "inventoryClient", "toInventory", "inventory"],
      packets: [
        { relation: "toInventoryClient", label: "getProduct(sku-1)" },
        { relation: "toInventory", label: "findProduct(sku-1)", after: 0 },
      ],
      notes: { inventory: "calls: 1", inventoryClient: "cache populated" },
      code: "inventoryClient",
    },
    {
      title: "The second lookup is a cache hit",
      description:
        "The order's second line also asks for sku-1. This time InventoryServiceClient finds it already cached and returns it without calling InventoryService again.",
      highlight: ["orders", "toInventoryClient", "inventoryClient"],
      packets: [{ relation: "toInventoryClient", label: "getProduct(sku-1)" }],
      notes: { inventoryClient: "cache hit", inventory: "calls: still 1" },
      code: "inventoryClient",
    },
    {
      title: "Payment succeeds, and Orders announces it",
      description:
        "Priced at $59.97, order-1 is charged through the CircuitBreaker while Payments is still healthy. It succeeds, so OrderService records it as PAID in its own private store and publishes OrderPlaced — ShippingService, subscribed to the broker, receives it.",
      highlight: [
        "orders",
        "toBreaker",
        "paymentsBreaker",
        "toPayments",
        "payments",
        "toBroker",
        "broker",
        "toShipping",
        "shipping",
      ],
      packets: [
        { relation: "toBreaker", label: "call(() => charge)" },
        { relation: "toPayments", label: "charge(order-1, 59.97)", after: 0 },
        { relation: "toBroker", label: "OrderPlaced", after: 1 },
        { relation: "toShipping", label: "onOrderPlaced(event)", after: 2 },
      ],
      notes: { orders: "order-1: PAID", payments: "calls: 1", shipping: "received: 1" },
      code: "orders",
    },
    {
      title: "Payments goes down",
      description:
        "The payment processor is switched off — a deterministic flag flip in the usage code, not a timer. Orders 2, 3 and 4 each fail to pay: OrderService records each as PAYMENT_FAILED and, since none of them paid, none of them is published to the broker.",
      highlight: ["orders", "toBreaker", "paymentsBreaker", "toPayments", "payments"],
      packets: [
        { relation: "toBreaker", label: "call(() => charge)" },
        { relation: "toPayments", label: "charge(orderId, total) ✗", after: 0 },
      ],
      notes: {
        payments: "calls: 4",
        orders: "order-4: PAYMENT_FAILED",
        paymentsBreaker: "CLOSED → OPEN",
      },
      code: "breaker",
    },
    {
      title: "The breaker trips open on the third failure",
      description:
        "order-4's failure is the breaker's third in a row since order-1 last succeeded and reset it — its failure threshold — so CircuitBreaker trips to OPEN right after that call returns.",
      highlight: ["paymentsBreaker"],
      notes: { paymentsBreaker: "OPEN after 3 failures" },
      code: "breaker",
    },
    {
      title: "The next charge fails fast",
      description:
        "order-5 reaches the payment step. The breaker is already OPEN, so the call fails immediately — PaymentsService.charge is never invoked, and its call count stays at 4. order-5 is recorded as PAYMENT_FAILED and, like orders 2 through 4, never reaches Shipping.",
      highlight: ["orders", "toBreaker", "paymentsBreaker"],
      packets: [{ relation: "toBreaker", label: "call(() => charge) ✗ — fails fast" }],
      notes: {
        paymentsBreaker: "OPEN — fails fast",
        payments: "calls unchanged: 4",
        shipping: "received unchanged: 1",
      },
      code: "breaker",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: MicroservicesVisualization,
};
