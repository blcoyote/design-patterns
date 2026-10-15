import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "backend-for-frontend",
  name: "Backend for Frontend",
  category: "enterprise",
  order: 22,
  summary:
    "One backend per kind of client: each one calls the shared services its UI needs and returns exactly the shape that UI wants, so the web page and the mobile app stop sharing one general API.",
  intent:
    "Give each kind of client (web, mobile, a partner integration) its own backend, usually owned by the team that builds that client. The backend calls the shared services, combines and reshapes their answers into what that one client shows, and handles their failures in the way that suits that client.",
  problem:
    "Different clients want different things from the same services. The web account page shows the profile, every order with its total and a list of recommendations; the mobile home screen shows a name, an order count and the last order, and has a slow network and a small screen. One general API serves both badly: the mobile app downloads data it throws away, or the web page makes several round trips, and every change for one client has to be negotiated with every other client of the API. Putting the shaping in the clients spreads service knowledge into every UI.",
  solution:
    "Put a small backend between each client and the services, and let it belong to that client. Here WebBff.accountPage calls ProfileService, then OrderService, then RecommendationService, and returns an AccountPage: a heading, one line per order with the total formatted from cents, and the recommendations. MobileBff.home calls only ProfileService and OrderService, never RecommendationService, and answers with compact JSON in the app's own field names: name, orderCount and lastOrder. The services stay general and know nothing about either client. Each BFF also decides how its client copes with a failure: when RecommendationService is down, WebBff still serves the account page, with the recommendations section marked unavailable, and the mobile app is not affected at all because its BFF never calls that service. A BFF is a Facade over several services and an Adapter into one client's model. It differs from an API Gateway, which is one shared entry point for every client. Here the BFFs and services are plain objects in one process and the calls run one after another, so the example runs the same in four languages; real BFFs are separate network services that usually make independent calls in parallel.",
  analogy:
    "A restaurant kitchen with two pass windows. The dining room's waiter collects a full plate with every side dish, and the delivery driver collects the same food packed into one compact box. Both draw on the same kitchen stations, but each window has its own person who knows what that customer needs and assembles it. If the dessert station is closed, the dining room plate goes out without dessert, and the delivery box, which never had dessert in it, is not affected.",
  whenToUse: [
    "Several kinds of client (web, iOS, Android, a partner API) need clearly different data or formats from the same services.",
    "A client would otherwise need several round trips, or would download much more than it shows, to build one screen.",
    "Each client is built by its own team, and that team should be able to change the data its UI receives without negotiating with every other client.",
    "Do NOT use it when there is one client, or when all clients want the same data: one API, or an API Gateway in front of the services, is less to build and run.",
  ],
  pros: [
    'Each client gets exactly the shape it needs. The mobile app receives {"name":"Alice","orderCount":2,"lastOrder":"order-2"} instead of a profile, a list of orders and their totals.',
    "A client calls only what it needs. MobileBff never calls RecommendationService, so a mobile request costs two service calls instead of three.",
    "Failure handling fits the client. WebBff turns a failing RecommendationService into an unavailable section and still serves the rest of the page.",
    "The team that owns a client also owns its BFF, so a change that spans the UI and the data it shows stays inside one team, and the shared services stay general.",
  ],
  cons: [
    "BFFs duplicate each other by design. WebBff and MobileBff both call ProfileService and OrderService and both reshape the answers. Without care, logic that belongs in a shared service is repeated in every BFF.",
    "Every BFF is another service to build, deploy, monitor and keep in step with the services behind it.",
    "A BFF can grow into a place for business rules. It should only combine, reshape and handle failures for its client, and leave decisions such as pricing to the services.",
    "The calls here run one after another to keep the example deterministic, and the services are in-process objects. A real BFF calls services over the network, usually in parallel, with timeouts, and often behind a Circuit Breaker.",
  ],
  realWorld: [
    "The Backend for Frontend pattern as described by Sam Newman, drawing on SoundCloud's move from one general API to a backend per client",
    "Netflix's device-specific API adapters, written by the client teams on top of shared services",
    "GraphQL servers deployed per client, each with a schema shaped for one app",
    "A Next.js or Remix server, which acts as the backend for its own web frontend",
  ],
  related: ["api-gateway", "facade", "adapter", "circuit-breaker"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "webApp",
      label: "Web app",
      role: "Client",
      kind: "client",
      x: 80,
      y: 130,
      width: 110,
      code: "clients",
      description:
        "The web frontend's account page. It knows only WebBff, asks it for an AccountPage and prints the heading, one line per order (or no orders) and the recommendations, or unavailable when that section could not be filled.",
    },
    {
      id: "mobileApp",
      label: "Mobile app",
      role: "Client",
      kind: "client",
      x: 80,
      y: 340,
      width: 110,
      code: "clients",
      description:
        "The mobile app's home screen. It knows only MobileBff, asks it for the home card and gets compact JSON back. It never learns which services stand behind its BFF.",
    },
    {
      id: "webBff",
      label: "WebBff",
      role: "Backend for Frontend",
      kind: "class",
      x: 320,
      y: 130,
      width: 120,
      code: "webBff",
      patterns: ["facade", "adapter"],
      description:
        "The web team's backend. accountPage calls ProfileService, then OrderService, then RecommendationService, and returns an AccountPage with a heading, order lines whose totals are formatted from cents, and the recommendations. If RecommendationService fails it sets the recommendations to null (None in Python, nil in Go) and still returns the page.",
    },
    {
      id: "mobileBff",
      label: "MobileBff",
      role: "Backend for Frontend",
      kind: "class",
      x: 320,
      y: 340,
      width: 120,
      code: "mobileBff",
      patterns: ["facade", "adapter"],
      description:
        "The mobile team's backend. home calls ProfileService and then OrderService, never RecommendationService, and returns compact JSON in the app's own field names: name, orderCount and lastOrder, which is null when there are no orders.",
    },
    {
      id: "recommendations",
      label: "RecommendationService",
      role: "Shared service",
      kind: "object",
      x: 620,
      y: 60,
      width: 200,
      code: "services",
      description:
        "A shared service whose forUser call returns picks for a user: socks, mug and lamp for alice, notebook for bob. It counts each call first thing. When the usage switches it down, the call fails after being counted.",
    },
    {
      id: "profiles",
      label: "ProfileService",
      role: "Shared service",
      kind: "object",
      x: 620,
      y: 200,
      width: 150,
      code: "services",
      description:
        "A shared service whose profile call returns the name and email of alice or bob. It counts each call first thing, and it is called by both BFFs.",
    },
    {
      id: "orders",
      label: "OrderService",
      role: "Shared service",
      kind: "object",
      x: 620,
      y: 340,
      width: 150,
      code: "services",
      description:
        "A shared service whose recent call returns a user's orders, oldest first: alice has order-1 (2 items, 1250 cents) and order-2 (3 items, 4999 cents), bob has none. It counts each call first thing, and it is called by both BFFs.",
    },
  ],
  relations: [
    {
      id: "getPage",
      from: "webApp",
      to: "webBff",
      type: "calls",
      label: "accountPage",
      description:
        "The web app asks its own BFF for the account page of a user and gets an AccountPage back.",
      code: "clients",
    },
    {
      id: "getHome",
      from: "mobileApp",
      to: "mobileBff",
      type: "calls",
      label: "home",
      description: "The mobile app asks its own BFF for the home card and gets compact JSON back.",
      code: "clients",
    },
    {
      id: "webProfile",
      from: "webBff",
      to: "profiles",
      type: "calls",
      label: "profile",
      description: "WebBff's first call: the profile, for the page heading.",
      code: "webBff",
    },
    {
      id: "webOrders",
      from: "webBff",
      to: "orders",
      type: "calls",
      label: "recent",
      bend: 30,
      description: "WebBff's second call: the orders, one line each on the page.",
      code: "webBff",
    },
    {
      id: "webRecs",
      from: "webBff",
      to: "recommendations",
      type: "calls",
      label: "forUser",
      description:
        "WebBff's third call: the recommendations. A failure here does not fail the page; WebBff marks the section unavailable.",
      code: "webBff",
    },
    {
      id: "mobileProfile",
      from: "mobileBff",
      to: "profiles",
      type: "calls",
      label: "profile",
      bend: 30,
      description: "MobileBff's first call: the profile, for the name on the card.",
      code: "mobileBff",
    },
    {
      id: "mobileOrders",
      from: "mobileBff",
      to: "orders",
      type: "calls",
      label: "recent",
      description:
        "MobileBff's second and last call: the orders, which it reduces to a count and the id of the last one.",
      code: "mobileBff",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "One backend per client",
      description:
        "Two clients use the same three shared services. Instead of one general API, each client has its own backend: WebBff for the web account page and MobileBff for the mobile home screen. Each client knows only its own BFF, and each BFF calls only the services its client needs. Everything here is an in-process object; real BFFs are separate network services owned by the client teams.",
      highlight: [
        "webApp",
        "mobileApp",
        "webBff",
        "mobileBff",
        "recommendations",
        "profiles",
        "orders",
      ],
      code: "services",
    },
    {
      title: "The web account page: three service calls",
      description:
        "The web app asks WebBff for alice's account page. WebBff calls ProfileService for the heading, then OrderService for the orders, then RecommendationService for the picks, and returns one AccountPage. The page shows Alice (alice@example.com), order-1: 2 items, 12.50, order-2: 3 items, 49.99 and recommended: socks, mug, lamp. The totals were formatted from cents by the BFF, not by the service or the page.",
      highlight: [
        "webApp",
        "getPage",
        "webBff",
        "webProfile",
        "profiles",
        "webOrders",
        "orders",
        "webRecs",
        "recommendations",
      ],
      packets: [
        { relation: "getPage", label: "accountPage(alice)" },
        { relation: "webProfile", label: "profile(alice)", after: 0 },
        { relation: "webProfile", label: "Alice", reverse: true, after: 1 },
        { relation: "webOrders", label: "recent(alice)", after: 2 },
        { relation: "webOrders", label: "2 orders", reverse: true, after: 3 },
        { relation: "webRecs", label: "forUser(alice)", after: 4 },
        { relation: "webRecs", label: "3 picks", reverse: true, after: 5 },
        { relation: "getPage", label: "AccountPage", reverse: true, after: 6 },
      ],
      notes: { profiles: "calls 1", orders: "calls 1", recommendations: "calls 1" },
      code: "webBff",
    },
    {
      title: "The mobile home card: two calls, compact JSON",
      description:
        'The mobile app asks MobileBff for alice\'s home card. MobileBff calls ProfileService and then OrderService, and never RecommendationService, because the home screen does not show recommendations. It reduces the orders to a count and the last id and answers with {"name":"Alice","orderCount":2,"lastOrder":"order-2"}. The same services, a different shape.',
      highlight: [
        "mobileApp",
        "getHome",
        "mobileBff",
        "mobileProfile",
        "profiles",
        "mobileOrders",
        "orders",
      ],
      packets: [
        { relation: "getHome", label: "home(alice)" },
        { relation: "mobileProfile", label: "profile(alice)", after: 0 },
        { relation: "mobileProfile", label: "Alice", reverse: true, after: 1 },
        { relation: "mobileOrders", label: "recent(alice)", after: 2 },
        { relation: "mobileOrders", label: "2 orders", reverse: true, after: 3 },
        { relation: "getHome", label: "JSON", reverse: true, after: 4 },
      ],
      notes: { profiles: "calls 2", orders: "calls 2", recommendations: "not called" },
      code: "mobileBff",
    },
    {
      title: "bob on mobile: no orders",
      description:
        'The mobile app asks for bob\'s home card. OrderService returns no orders, so MobileBff writes an orderCount of 0 and a lastOrder of null: {"name":"Bob","orderCount":0,"lastOrder":null}. The app gets a field it can test instead of an empty list to inspect.',
      highlight: [
        "mobileApp",
        "getHome",
        "mobileBff",
        "mobileProfile",
        "profiles",
        "mobileOrders",
        "orders",
      ],
      packets: [
        { relation: "getHome", label: "home(bob)" },
        { relation: "mobileProfile", label: "profile(bob)", after: 0 },
        { relation: "mobileProfile", label: "Bob", reverse: true, after: 1 },
        { relation: "mobileOrders", label: "recent(bob)", after: 2 },
        { relation: "mobileOrders", label: "no orders", reverse: true, after: 3 },
        { relation: "getHome", label: "JSON", reverse: true, after: 4 },
      ],
      notes: { profiles: "calls 3", orders: "calls 3", mobileBff: "lastOrder null" },
      code: "mobileBff",
    },
    {
      title: "A service fails: the web page degrades",
      description:
        "The usage switches RecommendationService down, then the web app asks for bob's account page. WebBff gets the profile and the (empty) orders, then its call to RecommendationService is counted and fails. WebBff catches the failure, sets the recommendations to null and still returns the page: Bob (bob@example.com), no orders, recommended: unavailable. How to cope with a failing service is the BFF's decision for its own client. The mobile app is not affected, because MobileBff never calls that service.",
      highlight: [
        "webApp",
        "getPage",
        "webBff",
        "webProfile",
        "profiles",
        "webOrders",
        "orders",
        "webRecs",
        "recommendations",
      ],
      packets: [
        { relation: "getPage", label: "accountPage(bob)" },
        { relation: "webProfile", label: "profile(bob)", after: 0 },
        { relation: "webProfile", label: "Bob", reverse: true, after: 1 },
        { relation: "webOrders", label: "recent(bob)", after: 2 },
        { relation: "webOrders", label: "no orders", reverse: true, after: 3 },
        { relation: "webRecs", label: "forUser(bob)", after: 4 },
        { relation: "webRecs", label: "error", reverse: true, after: 5 },
        { relation: "getPage", label: "AccountPage", reverse: true, after: 6 },
      ],
      notes: {
        profiles: "calls 4",
        orders: "calls 4",
        recommendations: "down, calls 2",
        webBff: "recommended: unavailable",
      },
      code: "webBff",
    },
    {
      title: "The price: duplication",
      description:
        "The run ends with profile 4, orders 4 and recommendations 2 calls. Both BFFs called ProfileService and OrderService and both reshaped the answers, each in its own way. That duplication is the price of letting each client team change its own backend without asking anyone else. Keep shared rules in the services, and keep each BFF to combining, reshaping and handling failures for its client. One shared entry point for every client is an API Gateway instead; the two are often combined.",
      highlight: ["webBff", "mobileBff", "profiles", "orders", "recommendations"],
      notes: { profiles: "calls 4", orders: "calls 4", recommendations: "calls 2" },
      code: "usage",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
