import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { ApiGatewayVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "api-gateway",
  name: "API Gateway",
  category: "enterprise",
  order: 18,
  summary:
    "One entry point in front of several services: it authenticates each request, applies rate limits, routes it to the right service and can combine several service calls into one response.",
  intent:
    "Give clients a single entry point to a set of backend services. The gateway receives each request, runs the checks that should not be rebuilt in every service (here authentication and rate limiting), routes the request to the service that owns it and, where it helps, combines several service calls into one response.",
  problem:
    "A client of a system built from several services has to know where each service lives and what its API looks like. The services would each have to authenticate callers and limit abuse on their own, in their own way. Adding, splitting or moving a service breaks clients, and a screen that needs data from two services costs the client two round trips.",
  solution:
    'Put one ApiGateway in front of the services and let clients talk only to it. For each request it runs the same sequence: authenticate the token to get a user id (401 if the token is unknown), ask the rate limiter whether that user is under the limit (429 if not), look up the route for "<METHOD> <path>" in a table (404 if there is none), then call the route\'s handler with the user id. The handlers call UserService and OrderService. One handler, GET /home, shows aggregation: a single client request becomes a profile call followed by an orders call, composed into one response. A gateway is more than a Facade: a Facade is a simpler interface to a subsystem, while a gateway is a network-level entry point that also applies cross-cutting checks (its GET /home handler, on its own, is a Facade over two services). It is not a Proxy either: a proxy keeps the interface of one subject, while a gateway fronts many services behind different routes. Here the gateway, limiter and services are plain objects in one process and a request is plain data, so the example runs the same in four languages. Real gateways are separate network processes configured with routes and plugins.',
  analogy:
    "The reception desk of an office building. Visitors come to one door, show an ID, and are turned away if the desk does not know them or if they have already visited too often today. Reception then sends each visitor to the right department, and for a visitor who needs two departments it can collect both answers and hand over one.",
  whenToUse: [
    "Clients should know one address instead of the address and API of each of several services.",
    "Authentication, rate limiting or routing is needed in front of several services and should not be rebuilt in each of them.",
    "A screen needs data from several services, and one round trip to a gateway is cheaper than several to the services, as long as the gateway only composes the answers and holds no business rules.",
    "Clients need clearly different shapes of response: consider a Backend-for-Frontend per client type instead of one shared gateway (see the Micro-frontends with Backends-for-Frontends architecture page).",
  ],
  pros: [
    "Clients depend on one address and one set of routes. Services can be moved, split or renamed behind it by changing the route table.",
    "Checks run in one place. In this example the 401 and the 429 are answered by the gateway and no service is called for them.",
    "A request that fails a check gets a status and a body straight from the gateway, in the same shape as a success.",
    "Aggregation saves round trips: GET /home is one client request and two service calls.",
  ],
  cons: [
    "All client traffic passes through the gateway, so it is one more hop, one more thing to run and scale, and a single point of failure unless it is deployed redundantly.",
    "A gateway that aggregates and transforms can collect business logic, and then every team that changes a service has to change the gateway as well. Not every gateway aggregates. Keep aggregation light, like the GET /home handler here.",
    "A shared gateway gives every client the same routes and the same response shapes, as in this example. A Backend-for-Frontend is one backend per client type instead. The two are often combined, and microservices.io lists BFF as a variation of the API gateway pattern. See the Micro-frontends with Backends-for-Frontends architecture page.",
    "The rate limiter here is a fixed-window counter whose window is advanced by an explicit next-window call instead of a clock. Real limiters often use sliding windows or token buckets, and keep their counters in shared storage when the gateway runs as several instances.",
    "The services trust the user id the gateway hands them. Real systems pass a signed token (for example a JWT) or secure the gateway-to-service hop (for example with mTLS), so a caller that bypasses the gateway cannot claim to be someone else.",
    "The checks run in a fixed sequence inside the gateway's request handler. Real gateways usually build them as a configurable filter or plugin chain, which is the Middleware pattern.",
  ],
  realWorld: [
    "Kong Gateway, a plugin-based gateway that routes to upstream services",
    "Amazon API Gateway, a managed service that puts an API in front of backend services",
    "Azure API Management, which sits in front of backend APIs and applies policies to the requests",
    "Spring Cloud Gateway, configured with routes and filters on the JVM",
    "YARP, a reverse proxy library for .NET that is used to build gateways",
    "Gateways built on NGINX or Envoy",
  ],
  related: ["facade", "proxy", "middleware", "circuit-breaker", "sidecar"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Clients",
      role: "Web and mobile apps",
      kind: "client",
      x: 70,
      y: 230,
      width: 110,
      code: "usage",
      description:
        "Any caller of the system, such as a web or mobile app. It knows one address, the gateway, and sends a request made of a token, a method and a path. It does not know how many services there are behind the gateway. In the example, the send helper plays the client and hands every request to the gateway only.",
    },
    {
      id: "gateway",
      label: "ApiGateway",
      role: "API Gateway",
      kind: "class",
      x: 270,
      y: 230,
      width: 140,
      code: "gateway",
      description:
        'The single entry point. For each request it runs the same sequence: authenticate the token, ask the rate limiter, look up the route for "<METHOD> <path>" and call the route\'s handler with the user id. A failing check is answered by the gateway itself with 401, 429 or 404, and the rest of the sequence does not run. In a real system it would be a separate network process configured with routes and plugins; here it is an in-process object.',
    },
    {
      id: "authenticator",
      label: "Authenticator",
      role: "Authentication",
      kind: "class",
      x: 270,
      y: 80,
      width: 150,
      code: "authenticator",
      description:
        "Maps a token to a user id: token-alice is alice and token-bob is bob. For any other token it returns no user id, and the gateway answers 401. It is a lookup in a fixed table; a real gateway would typically validate a signed token or ask an identity provider.",
    },
    {
      id: "rateLimiter",
      label: "FixedWindowRateLimiter",
      role: "Rate limiting",
      kind: "class",
      x: 270,
      y: 380,
      width: 200,
      code: "rateLimiter",
      description:
        "Keeps a count of requests per user for the current window, with a limit of 3. Its try-acquire check counts the request and says yes while the user has used fewer than the limit. At the limit it says no and does not count the request. Its next-window call clears every count. The window is advanced by that explicit call instead of a clock; real limiters often use sliding windows or token buckets and share their counters between gateway instances.",
    },
    {
      id: "aggregator",
      label: "GET /home handler",
      role: "Aggregation",
      kind: "class",
      x: 500,
      y: 230,
      width: 140,
      code: "aggregation",
      patterns: ["facade"],
      description:
        "The handler behind GET /home. One client request becomes two service calls, first the profile from UserService and then the recent orders from OrderService, composed into one body such as Alice: 2 orders. It is a Facade over the two services. Not every gateway aggregates, and it is best kept light.",
    },
    {
      id: "users",
      label: "UserService",
      role: "Backend service",
      kind: "object",
      x: 712,
      y: 120,
      width: 120,
      code: "services",
      description:
        "A backend service whose profile call returns the name and email of alice or bob. It counts each call first thing, so the example can show which requests reached it. It trusts the user id it is given; a real system would pass a signed token or secure the hop from the gateway.",
    },
    {
      id: "orders",
      label: "OrderService",
      role: "Backend service",
      kind: "object",
      x: 712,
      y: 340,
      width: 120,
      code: "services",
      description:
        "A backend service whose recent call returns a user's recent orders in a fixed order: alice has order-1 with 2 items and order-2 with 3 items, bob has none. It counts each call first thing and trusts the user id it is given, like UserService.",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "gateway",
      type: "calls",
      label: "request",
      description:
        "The client sends a request with a token, a method and a path to the gateway. The response, whether a success or a 401, 429 or 404 from the gateway, comes back along the same arrow.",
      code: "usage",
    },
    {
      id: "authenticate",
      from: "gateway",
      to: "authenticator",
      type: "calls",
      label: "authenticate",
      description:
        "The gateway's first check: it passes the token to the Authenticator and gets back a user id, or nothing for an unknown token.",
      code: "gateway",
    },
    {
      id: "tryAcquire",
      from: "gateway",
      to: "rateLimiter",
      type: "calls",
      label: "tryAcquire",
      description:
        "The second check, made only for an authenticated user: the gateway asks the limiter whether this user may make another request in the current window.",
      code: "gateway",
    },
    {
      id: "getProfile",
      from: "gateway",
      to: "users",
      type: "calls",
      label: "GET /profile",
      bend: -12,
      description:
        "The gateway finds the handler for GET /profile in its route table and calls it with the user id. The handler calls UserService.",
      code: "routes",
    },
    {
      id: "getOrders",
      from: "gateway",
      to: "orders",
      type: "calls",
      label: "GET /orders",
      bend: 12,
      description:
        "The gateway finds the handler for GET /orders in its route table and calls it with the user id. The handler calls OrderService and builds the body from the orders it gets back.",
      code: "routes",
    },
    {
      id: "getHome",
      from: "gateway",
      to: "aggregator",
      type: "calls",
      label: "GET /home",
      description:
        "The route table maps GET /home to the aggregating handler. The gateway calls it like any other handler, with the user id.",
      code: "routes",
    },
    {
      id: "aggProfile",
      from: "aggregator",
      to: "users",
      type: "calls",
      label: "profile",
      bend: -10,
      description:
        "The aggregating handler's first service call: it asks UserService for the user's profile.",
      code: "aggregation",
    },
    {
      id: "aggRecent",
      from: "aggregator",
      to: "orders",
      type: "calls",
      label: "recent",
      bend: 10,
      description:
        "The aggregating handler's second service call, made after the profile has come back: it asks OrderService for the user's recent orders and counts them.",
      code: "aggregation",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "One entry point in front of the services",
      description:
        "Clients know only the gateway. Behind it sit UserService and OrderService, and the gateway uses an Authenticator, a FixedWindowRateLimiter (limit 3 per window) and a route table. For each request it authenticates, rate-limits and routes, and for GET /home it also aggregates. Everything here is an in-process object and a request is plain data; a real gateway is a separate network process configured with routes and plugins.",
      highlight: [
        "client",
        "gateway",
        "authenticator",
        "rateLimiter",
        "aggregator",
        "users",
        "orders",
      ],
      code: "gateway",
    },
    {
      title: "GET /profile for alice",
      description:
        "alice sends GET /profile with token-alice. The Authenticator maps the token to alice, the rate limiter counts the request (alice 1 of 3), and the gateway finds the route for GET /profile. Its handler calls UserService, and the 200 response with Alice <alice@example.com> goes back to the client. The checks ran in a fixed order: authenticate, limit, route.",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
        "getProfile",
        "users",
      ],
      packets: [
        { relation: "request", label: "GET /profile" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "alice", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(alice)", after: 2 },
        { relation: "tryAcquire", label: "allowed", reverse: true, after: 3 },
        { relation: "getProfile", label: "profile(alice)", after: 4 },
        { relation: "getProfile", label: "Alice", reverse: true, after: 5 },
        { relation: "request", label: "200", reverse: true, after: 6 },
      ],
      notes: { rateLimiter: "alice 1/3", users: "calls 1" },
      code: "gateway",
    },
    {
      title: "GET /orders for alice",
      description:
        "The same checks run again: token-alice is alice, and the limiter counts alice's second request (alice 2 of 3). The route for GET /orders calls OrderService, which returns two orders, and the handler builds the body order-1 (2 items), order-2 (3 items).",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
        "getOrders",
        "orders",
      ],
      packets: [
        { relation: "request", label: "GET /orders" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "alice", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(alice)", after: 2 },
        { relation: "tryAcquire", label: "allowed", reverse: true, after: 3 },
        { relation: "getOrders", label: "recent(alice)", after: 4 },
        { relation: "getOrders", label: "2 orders", reverse: true, after: 5 },
        { relation: "request", label: "200", reverse: true, after: 6 },
      ],
      notes: { rateLimiter: "alice 2/3", orders: "calls 1" },
      code: "routes",
    },
    {
      title: "One request, two service calls",
      description:
        "alice sends GET /home. The checks pass and the limiter counts alice's third request (alice 3 of 3). The route is the aggregating handler: it calls UserService for the profile first, then OrderService for the recent orders, and composes Alice: 2 orders. The client made one request and the services received two calls. The call counters across the run so far are now users 2 and orders 2.",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
        "getHome",
        "aggregator",
        "aggProfile",
        "users",
        "aggRecent",
        "orders",
      ],
      packets: [
        { relation: "request", label: "GET /home" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "alice", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(alice)", after: 2 },
        { relation: "tryAcquire", label: "allowed", reverse: true, after: 3 },
        { relation: "getHome", label: "handler(alice)", after: 4 },
        { relation: "aggProfile", label: "profile(alice)", after: 5 },
        { relation: "aggProfile", label: "Alice", reverse: true, after: 6 },
        { relation: "aggRecent", label: "recent(alice)", after: 7 },
        { relation: "aggRecent", label: "2 orders", reverse: true, after: 8 },
        { relation: "getHome", label: "Alice: 2 orders", reverse: true, after: 9 },
        { relation: "request", label: "200", reverse: true, after: 10 },
      ],
      notes: { rateLimiter: "alice 3/3", users: "calls 2", orders: "calls 2" },
      code: "aggregation",
    },
    {
      title: "An unknown token is stopped at the gateway",
      description:
        "A request arrives with token-mallory. The Authenticator knows no such token and returns no user id, so the gateway answers 401 unknown token itself. Nothing after the first check ran: the rate limiter was not asked and no service was called, so alice stays at 3 of 3 and the service counters stay as they were.",
      highlight: ["client", "request", "gateway", "authenticate", "authenticator"],
      packets: [
        { relation: "request", label: "GET /orders" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "no user", reverse: true, after: 1 },
        { relation: "request", label: "401", reverse: true, after: 2 },
      ],
      notes: { rateLimiter: "not asked", users: "not called", orders: "not called" },
      code: "gateway",
    },
    {
      title: "Over the limit: 429",
      description:
        "alice sends GET /profile again. alice authenticates, but the limiter already has alice at 3 of 3, so it refuses the request and does not count it. The gateway answers 429 rate limit: 3 requests per window. It never looks up a route, so UserService is not called and stays at 2 calls.",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
      ],
      packets: [
        { relation: "request", label: "GET /profile" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "alice", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(alice)", after: 2 },
        { relation: "tryAcquire", label: "rejected", reverse: true, after: 3 },
        { relation: "request", label: "429", reverse: true, after: 4 },
      ],
      notes: { rateLimiter: "alice 3/3", users: "still 2 calls" },
      code: "rateLimiter",
    },
    {
      title: "A new window, then a missing route: 404",
      description:
        "The usage tells the gateway to start the next window, which clears every user's count; it stands in for a clock reaching the next window. Then alice sends GET /admin. alice authenticates and the limiter counts the request (alice 1 of 3). Only then does the gateway look up the route, finds none for GET /admin and answers 404 no route for GET /admin. The request still used one of alice's slots, because limiting happens before routing.",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
      ],
      packets: [
        { relation: "request", label: "GET /admin" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "alice", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(alice)", after: 2 },
        { relation: "tryAcquire", label: "allowed", reverse: true, after: 3 },
        { relation: "request", label: "404", reverse: true, after: 4 },
      ],
      notes: { rateLimiter: "alice 1/3" },
      code: "gateway",
    },
    {
      title: "bob is counted separately",
      description:
        "bob sends GET /orders with token-bob. The limiter keeps a separate count per user, so bob's count starts at bob 1 of 3 while alice stays at 1 of 3. OrderService returns no orders for bob, so the response is still a 200, with the body no orders. OrderService has now been called 3 times in the run.",
      highlight: [
        "client",
        "request",
        "gateway",
        "authenticate",
        "authenticator",
        "tryAcquire",
        "rateLimiter",
        "getOrders",
        "orders",
      ],
      packets: [
        { relation: "request", label: "GET /orders" },
        { relation: "authenticate", label: "authenticate(token)", after: 0 },
        { relation: "authenticate", label: "bob", reverse: true, after: 1 },
        { relation: "tryAcquire", label: "tryAcquire(bob)", after: 2 },
        { relation: "tryAcquire", label: "allowed", reverse: true, after: 3 },
        { relation: "getOrders", label: "recent(bob)", after: 4 },
        { relation: "getOrders", label: "no orders", reverse: true, after: 5 },
        { relation: "request", label: "200", reverse: true, after: 6 },
      ],
      notes: { rateLimiter: "bob 1/3", orders: "calls 3" },
      code: "routes",
    },
    {
      title: "What reached the services",
      description:
        "The run ends with users 2 calls and orders 3 calls. The 401 and the 429 were answered by the gateway before any route was looked up, and the 404 had no route to call, so none of the three reached a service. The final counts are alice 1 of 3 and bob 1 of 3. Here every client gets the same routes and response shapes from one shared gateway. A Backend-for-Frontend would give each client type its own backend instead, and the two are often combined.",
      highlight: ["gateway", "rateLimiter", "users", "orders"],
      notes: { users: "calls 2", orders: "calls 3", rateLimiter: "alice 1/3, bob 1/3" },
      code: "usage",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Two dashed regions group the gateway's parts at the edge and the services behind it.
  Visualization: ApiGatewayVisualization,
};
