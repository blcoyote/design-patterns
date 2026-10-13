import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "strangler-fig",
  name: "Strangler Fig",
  category: "enterprise",
  order: 19,
  summary:
    "Replace a legacy system piece by piece: a facade in front of it routes each feature to the old or the new implementation, one feature moves at a time, and the old system is removed once nothing routes to it.",
  intent:
    "Replace a legacy system gradually instead of in one big rewrite: put a facade in front of it, move one feature at a time to a new implementation, and retire the legacy system once no feature is routed to it any more.",
  problem:
    "A legacy system has to be replaced, but a big-bang rewrite means building everything before anything can go live, and switching over in one risky step. Meanwhile the old system still has to be kept running and changed. Clients depend on its requests, so they cannot be told to change them on the day of the cutover either. A failed cutover is hard to undo, because the old system was switched off or left behind.",
  solution:
    "Put a StranglerFacade in front of both systems. It accepts the same kind of request the legacy system always did, looks up the feature in a route table and forwards the request to LegacyMonolith or to ModernService. At the start every feature is routed to the legacy system. Each feature is then moved on its own: the data it needs is copied over (for products, before this example starts; for orders, by the copy step), the route is flipped to the new implementation, and a rollback is a single call that flips it back. Once no feature is routed to the legacy system, the facade marks it as retired. Clients never change their requests: the facade is the only thing they know. In this example a feature moves all at once, by an explicit call. One thing to watch is the order: routing orders to the modern service before the copy step has run makes it answer 404.",
  analogy:
    'The pattern is named after the strangler fig, a vine that starts in the branches of a host tree, sends roots down and slowly grows around it. Over the years the vine takes over the tree\'s role until the host is gone and only the vine stands. Martin Fowler used the image for software, in his article "StranglerFigApplication": the new system grows around the old one, takes over its work bit by bit, and the old one is removed when nothing depends on it.',
  whenToUse: [
    "A legacy system must be replaced, but it has to keep running and keep serving its clients while that happens.",
    "A big-bang rewrite is too risky or takes too long, and value should reach users feature by feature.",
    "The features can be reached through one entry point (an HTTP path, a message type, a menu) that a facade can route on, so clients do not need to change their requests.",
  ],
  pros: [
    "Risk is spread out: each cutover moves one feature, and a rollback is another call to the facade instead of a restore of the whole system.",
    "The new system goes live early and grows feature by feature, so it can be checked against real traffic long before the legacy system is gone.",
    "Clients never change their requests. The facade keeps the same request interface while the implementation behind it is swapped.",
    "The share of features routed to the legacy system shrinks one feature at a time, while its code is never edited during the migration, and there is a clear end: when no feature is routed to it, it can be retired.",
  ],
  cons: [
    "Moving the data is usually the hard part. Real migrations need dual writes, change data capture or sync jobs to keep the old and the new store consistent. Here a single copy step stands in for all of that.",
    "Rollback works in this example only because nothing is written: the legacy system still has current data after the rollback. In a real system, writes made through the modern side after a switch must flow back to the legacy side, or a rollback loses them.",
    "A migrated feature can give a wrong answer instead of a crash. Here the modern service answers 404 when its data has not been migrated yet. Running both systems side by side on the same request and comparing the answers before switching (a parallel run or shadow traffic, as in GitHub's Scientist library) catches this.",
    "For as long as the migration lasts, two systems and a facade have to be run, deployed and kept in step. The facade is an extra component and, in a real deployment, an extra hop on every request.",
    "Features that are tightly coupled inside the legacy system are hard to peel off one at a time, and a migration can stall half way with both systems kept for good.",
  ],
  realWorld: [
    'Martin Fowler\'s "StranglerFigApplication" article, which named the pattern after the strangler fig vine.',
    "In real migrations the facade is usually a reverse proxy, an API gateway or a set of load-balancer routing rules, sometimes with feature flags or a percentage of traffic moved at a time (a canary), not an in-process object.",
    "GitHub's Scientist library, which runs the old and the new code path side by side and compares the results, is a way to find wrong answers before switching a route.",
    "Change data capture and sync jobs, which keep the data of the old and the new system aligned while a feature moves.",
    "The Azure Architecture Center describes it as a cloud design pattern named Strangler Fig.",
  ],
  related: ["facade", "proxy", "anti-corruption-layer", "adapter", "api-gateway"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 80,
      y: 230,
      code: "usage",
      description:
        "Sends GET requests and knows only the facade. Its requests are the same before, during and after the migration: it only learns which system answered from the served-by value in the reply, which this example prints.",
    },
    {
      id: "facade",
      label: "StranglerFacade",
      role: "Routing facade",
      kind: "class",
      x: 340,
      y: 230,
      width: 160,
      patterns: ["facade", "proxy"],
      description:
        "Stands in front of both systems and accepts the same kind of request the legacy system always did, so it looks like the system it replaces. It keeps a route table with one entry per feature (products, orders, invoices), all starting on legacy, and forwards each request to the system that the table names. The migrate call and the rollback flip one entry. The retire call is refused while any entry still names legacy. Real facades are reverse proxies, API gateways or load-balancer rules, sometimes with feature flags or a share of the traffic. Here it is an in-process object and a feature moves all at once.",
    },
    {
      id: "legacy",
      label: "LegacyMonolith",
      role: "Legacy system (fewer routes)",
      kind: "class",
      x: 620,
      y: 90,
      width: 170,
      description:
        "The old code being strangled. It answers products, orders and invoices from its own data, with a list of three products and a list holding order 42, and counts the calls it receives. It is never edited during the migration; it only gets fewer and fewer requests.",
    },
    {
      id: "migration",
      label: "copyOrders",
      role: "Data migration",
      kind: "object",
      x: 620,
      y: 230,
      width: 170,
      description:
        "The copy step: it reads a snapshot of the legacy order list, imports each record into the modern service in list order, prints how many it copied and returns that number. Moving data is usually the hard part of a migration (dual writes, change data capture, sync jobs), and one explicit copy stands in for all of that here.",
    },
    {
      id: "modern",
      label: "ModernService",
      role: "New implementation (growing)",
      kind: "class",
      x: 620,
      y: 370,
      width: 170,
      description:
        "The new implementation, with the same features and the same answers as the legacy system. It was built with its own copy of the products, but its order list starts empty. Until the copy step has imported order 42, it answers an order request with 404, a wrong answer rather than a crash. It counts its calls too, including the ones that end in 404.",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "facade",
      type: "calls",
      label: "GET <path>",
      code: "usage",
      description:
        "The client sends a request for a path such as /products or /orders/42 to the facade and gets back the reply together with the name of the system that served it. The request looks the same whichever system ends up answering.",
    },
    {
      id: "legacy-route",
      from: "facade",
      to: "legacy",
      type: "calls",
      label: "legacy route",
      code: "facade",
      description:
        "When the route table names legacy for the requested feature, the facade passes the request to LegacyMonolith and returns that reply's status and body together with a served-by value of legacy.",
    },
    {
      id: "modern-route",
      from: "facade",
      to: "modern",
      type: "calls",
      label: "modern route",
      code: "facade",
      description:
        "When the route table names modern for the requested feature, the facade passes the request to ModernService instead and returns that reply's status and body together with a served-by value of modern.",
    },
    {
      id: "read-orders",
      from: "migration",
      to: "legacy",
      type: "calls",
      label: "read orders",
      code: "migration",
      description:
        "The copy step asks the legacy system for a snapshot (a copy) of its order list. It only reads: the legacy system keeps its own orders.",
    },
    {
      id: "import-order",
      from: "migration",
      to: "modern",
      type: "calls",
      label: "import order",
      code: "migration",
      description:
        "The copy step hands each record from the snapshot to the modern service, which appends a copy of it to its own order list.",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "The client only knows the facade",
      description:
        "Every request goes to the facade, and its route table sends every feature to the legacy system. The modern service already exists, with its own copy of the products, but its order list is empty. Nothing has moved yet, and no request has been sent.",
      highlight: ["client", "request", "facade", "legacy", "modern"],
      notes: {
        facade: "products: legacy · orders: legacy · invoices: legacy",
        legacy: "calls: 0",
        modern: "calls: 0 · orders: 0",
      },
      code: "facade",
    },
    {
      title: "Everything still goes to legacy",
      description:
        "The client asks for /products, and then for /orders/42. Both times the facade looks up the feature, finds legacy in the route table and forwards the request. The legacy system answers 200, and the facade hands the reply back. The legacy system has now received 2 calls, and the modern service none.",
      highlight: ["client", "request", "facade", "legacy-route", "legacy"],
      packets: [
        { relation: "request", label: "GET /products" },
        { relation: "legacy-route", label: "GET /products", after: 0 },
        { relation: "legacy-route", label: "200 · 3 products", reverse: true, after: 1 },
        { relation: "request", label: "200 from legacy", reverse: true, after: 2 },
        { relation: "request", label: "GET /orders/42", after: 3 },
        { relation: "legacy-route", label: "GET /orders/42", after: 4 },
        { relation: "legacy-route", label: "200 · order 42", reverse: true, after: 5 },
        { relation: "request", label: "200 from legacy", reverse: true, after: 6 },
      ],
      notes: {
        facade: "products: legacy · orders: legacy · invoices: legacy",
        legacy: "calls: 2",
        modern: "calls: 0 · orders: 0",
      },
      code: "facade",
    },
    {
      title: "Move one feature: products",
      description:
        "The migrate call flips a single entry of the route table, from legacy to modern for products, and the facade prints the change. The client asks for /products again, with exactly the same request, and the modern service answers with the same 3 products. Orders and invoices still go to the legacy system.",
      highlight: ["client", "request", "facade", "modern-route", "modern"],
      packets: [
        { relation: "request", label: "GET /products" },
        { relation: "modern-route", label: "GET /products", after: 0 },
        { relation: "modern-route", label: "200 · 3 products", reverse: true, after: 1 },
        { relation: "request", label: "200 from modern", reverse: true, after: 2 },
      ],
      notes: {
        facade: "products: modern · orders: legacy · invoices: legacy",
        legacy: "calls: 2",
        modern: "calls: 1 · orders: 0",
      },
      code: "facade",
    },
    {
      title: "Too early: a wrong answer, not a crash",
      description:
        'Orders are routed to the modern service before the data has been copied. The request for /orders/42 reaches the modern service, whose order list is empty, so it answers 404 "order 42 not found". Nothing crashes: the modern service just gives a wrong answer, because the legacy system does know that order. A parallel run or shadow traffic, comparing both answers before the switch, would have caught it. Here the example simply sees the 404.',
      highlight: ["client", "request", "facade", "modern-route", "modern"],
      packets: [
        { relation: "request", label: "GET /orders/42" },
        { relation: "modern-route", label: "GET /orders/42", after: 0 },
        { relation: "modern-route", label: "404 · not found", reverse: true, after: 1 },
        { relation: "request", label: "404 from modern", reverse: true, after: 2 },
      ],
      notes: {
        facade: "products: modern · orders: modern · invoices: legacy",
        legacy: "calls: 2",
        modern: "calls: 2 · orders: 0",
      },
      code: "modern",
    },
    {
      title: "Roll back orders",
      description:
        "The rollback flips the orders entry back to legacy, and the next /orders/42 is answered by the legacy system again, with 200. The legacy system has now received 3 calls. This works here only because nothing is written in this scenario, so the legacy system still has current data. In a real system, writes made through the modern side after a switch must flow back to the legacy side, or a rollback loses them.",
      highlight: ["client", "request", "facade", "legacy-route", "legacy"],
      packets: [
        { relation: "request", label: "GET /orders/42" },
        { relation: "legacy-route", label: "GET /orders/42", after: 0 },
        { relation: "legacy-route", label: "200 · order 42", reverse: true, after: 1 },
        { relation: "request", label: "200 from legacy", reverse: true, after: 2 },
      ],
      notes: {
        facade: "products: modern · orders: legacy · invoices: legacy",
        legacy: "calls: 3",
        modern: "calls: 2 · orders: 0",
      },
      code: "facade",
    },
    {
      title: "Move the data",
      description:
        "The copy step reads a snapshot of the legacy order list, which holds order 42, and imports each record into the modern service. One order is copied, and the step prints the count, 1. The modern order list now has 1 entry. The legacy system keeps its own copy, because the copy step only reads from it. Real migrations have to keep both stores in step while a feature moves (dual writes, change data capture, sync jobs); this single copy stands in for that.",
      highlight: ["migration", "read-orders", "import-order", "legacy", "modern"],
      packets: [
        { relation: "read-orders", label: "read orders" },
        { relation: "read-orders", label: "1 order", reverse: true, after: 0 },
        { relation: "import-order", label: "import 42", after: 1 },
      ],
      notes: {
        facade: "products: modern · orders: legacy · invoices: legacy",
        legacy: "calls: 3",
        modern: "calls: 2 · orders: 1",
      },
      code: "migration",
    },
    {
      title: "Move orders, this time with data",
      description:
        'The migrate call routes orders to the modern service again. Now /orders/42 is answered with 200 "order 42, 2 items", the same answer the legacy system gave, and the client has not changed anything. The modern service has received 3 calls so far, one of them the earlier 404.',
      highlight: ["client", "request", "facade", "modern-route", "modern"],
      packets: [
        { relation: "request", label: "GET /orders/42" },
        { relation: "modern-route", label: "GET /orders/42", after: 0 },
        { relation: "modern-route", label: "200 · order 42", reverse: true, after: 1 },
        { relation: "request", label: "200 from modern", reverse: true, after: 2 },
      ],
      notes: {
        facade: "products: modern · orders: modern · invoices: legacy",
        legacy: "calls: 3",
        modern: "calls: 3 · orders: 1",
      },
      code: "facade",
    },
    {
      title: "Retiring is refused until the last feature moves",
      description:
        'The retire call first finds that invoices are still routed to the legacy system, so the facade prints that it cannot retire it and returns false. The migrate call then moves invoices, and /invoices/42 is answered by the modern service with 200 "invoice for order 42: 2 lines". The modern service has received 4 calls, and every feature in the route table now names modern.',
      highlight: ["client", "request", "facade", "modern-route", "modern"],
      packets: [
        { relation: "request", label: "GET /invoices/42" },
        { relation: "modern-route", label: "GET /invoices/42", after: 0 },
        { relation: "modern-route", label: "200 · invoice", reverse: true, after: 1 },
        { relation: "request", label: "200 from modern", reverse: true, after: 2 },
      ],
      notes: {
        facade: "products: modern · orders: modern · invoices: modern",
        legacy: "calls: 3",
        modern: "calls: 4 · orders: 1",
      },
      code: "facade",
    },
    {
      title: "Retire the legacy system",
      description:
        "No feature is routed to the legacy system now, so the second retire call succeeds: the facade marks it as retired and prints so. Here that is a flag; in a real migration it is the moment the old system can be switched off. The final tally is legacy 3 calls and modern 4, out of 7 requests. Legacy's share went from all three features to none, one feature at a time, and the client never changed its requests.",
      highlight: ["client", "facade", "legacy", "modern"],
      notes: {
        facade: "products: modern · orders: modern · invoices: modern",
        legacy: "calls: 3 · retired",
        modern: "calls: 4 · orders: 1",
      },
      code: "usage",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
