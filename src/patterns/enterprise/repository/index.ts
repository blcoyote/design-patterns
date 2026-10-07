import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "repository",
  name: "Repository",
  category: "enterprise",
  order: 2,
  summary: "Hide persistence behind a collection-like interface so domain code never sees SQL.",
  intent:
    "Give the domain code a collection-like interface for loading and saving objects, so it never deals with the storage details.",
  problem:
    "Without a boundary, SQL strings, ORM query builders and connection handling creep into services and controllers. Every piece of code that needs an Order ends up knowing the shape of the orders table. The same query gets copy-pasted in three places, unit tests need a real database just to exercise business logic, and swapping or upgrading the data store means hunting down every call site that touches it.",
  solution:
    "Define a Repository interface shaped like a collection of domain objects. Behind it, a concrete class (here SqlOrderRepository) knows how to talk to the real store: it builds the SQL, runs it, and maps rows back into fully formed domain objects. Application code is written against the interface only, so a SqlOrderRepository can be swapped for an InMemoryOrderRepository in tests, or for a different store later, without changing a single caller.",
  analogy:
    'A library catalogue desk. You ask for "the 2023 edition of this title" and get a book back. You never learn whether it came off the open shelves, a back-room archive or an inter-library loan. The request looks the same either way, because the desk hides where the books actually live.',
  whenToUse: [
    "Domain or application logic is getting tangled up with SQL, ORM query builders or other storage-specific APIs.",
    "You want to unit test business logic without starting a real database.",
    "Several parts of the app need the same queries and you want them defined once instead of copy-pasted.",
    "You expect to change or add a data store later (SQL today, a cache or a different engine tomorrow) without rewriting every caller.",
  ],
  pros: [
    "Hides persistence details behind a small, collection-like interface.",
    "Makes domain and application logic easy to test with an in-memory fake instead of a real database.",
    "Keeps query logic in one place so it is not duplicated across services.",
    "Switching data stores means writing a new repository, not rewriting every consumer.",
  ],
  cons: [
    "Can become a leaky abstraction: once real query needs (filtering, pagination, joins) arrive, the interface tends to balloon.",
    "Adds a layer of indirection that simple, single-datastore CRUD apps may never need.",
    "Can hide performance problems such as N+1 queries or missing indexes behind a deceptively simple-looking call.",
  ],
  realWorld: [
    "Spring Data JPA repository interfaces, implemented automatically from method name conventions",
    "Entity Framework / DDD-style repository classes wrapping a DbContext in .NET codebases",
    "TypeORM and Doctrine repository classes, one per entity",
    "Hand-rolled repository classes in Rails or Django apps that keep ActiveRecord/ORM calls out of controllers",
  ],
  related: ["unit-of-work", "facade", "adapter", "dependency-injection", "anti-corruption-layer"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "OrderService",
      role: "Client",
      kind: "client",
      x: 110,
      y: 230,
      width: 160,
      description:
        "Application/domain service that needs orders. It is constructed with something typed as OrderRepository and never knows which concrete class sits behind it.",
    },
    {
      id: "orderRepository",
      label: "OrderRepository",
      role: "Repository interface",
      kind: "interface",
      x: 400,
      y: 90,
      width: 230,
      description:
        "Declares a collection-like contract — findById, findByCustomer, add, save, remove — expressed purely in terms of domain objects, with no hint of SQL or any other storage technology.",
    },
    {
      id: "sqlOrderRepository",
      label: "SqlOrderRepository",
      role: "Concrete Repository",
      kind: "class",
      x: 650,
      y: 230,
      width: 190,
      description:
        "Implements OrderRepository against a real Database: builds SQL for each method, executes it, and maps the resulting rows into Order domain objects.",
    },
    {
      id: "database",
      label: "Database",
      role: "Data source",
      kind: "class",
      x: 400,
      y: 230,
      width: 140,
      description:
        "A thin stand-in for a real database connection. It only understands query(sql, params) and returns plain, untyped rows — it has no concept of an Order.",
    },
    {
      id: "order",
      label: "Order",
      role: "Domain object",
      kind: "object",
      x: 400,
      y: 390,
      width: 140,
      description:
        "A plain domain object with no persistence logic of its own. Both repository implementations produce and hand back instances of this same class.",
    },
    {
      id: "inMemoryOrderRepository",
      label: "InMemoryOrderRepository",
      role: "Concrete Repository (test double)",
      kind: "class",
      x: 650,
      y: 390,
      width: 220,
      description:
        "Implements the same OrderRepository interface backed by a plain in-memory map (Map / Dictionary / dict) instead of a database — used in unit tests so business logic can run with no real storage at all.",
    },
  ],
  relations: [
    {
      id: "find",
      from: "client",
      to: "orderRepository",
      type: "calls",
      label: "findById(id)",
      description:
        "OrderService calls findById() on whatever it was handed, through the OrderRepository type — it never references a concrete repository class directly.",
      bend: 10,
      code: "client",
    },
    {
      id: "sqlImpl",
      from: "sqlOrderRepository",
      to: "orderRepository",
      type: "implements",
      description:
        "SqlOrderRepository implements OrderRepository so it can be handed to OrderService anywhere one is expected.",
      bend: 25,
      code: "sqlOrderRepository",
    },
    {
      id: "memImpl",
      from: "inMemoryOrderRepository",
      to: "orderRepository",
      type: "implements",
      description:
        "InMemoryOrderRepository implements the exact same interface, which is what lets it stand in for the SQL repository in tests.",
      bend: -30,
      code: "inMemoryOrderRepository",
    },
    {
      id: "query",
      from: "sqlOrderRepository",
      to: "database",
      type: "calls",
      label: "query(sql, params)",
      description:
        "findById() translates the request into a parameterized SQL statement and sends it to the Database, which has no idea an Order exists.",
      code: "findById",
    },
    {
      id: "map",
      from: "sqlOrderRepository",
      to: "order",
      type: "creates",
      label: "new Order(row)",
      description:
        "The raw row that comes back from the Database is mapped into a fully-typed Order before it ever leaves the repository.",
      code: "mapRow",
    },
    {
      id: "memHolds",
      from: "inMemoryOrderRepository",
      to: "order",
      type: "holds",
      label: "map: id → Order",
      description:
        "The in-memory repository keeps Order instances directly in an in-memory map keyed by id, so a lookup is a single key read — no SQL, no mapping step.",
      code: "inMemoryOrderRepository",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Service depends only on the interface",
      description:
        "OrderService is constructed with a repo typed as OrderRepository. Its code never mentions SqlOrderRepository or InMemoryOrderRepository by name.",
      highlight: ["client", "find", "orderRepository"],
      notes: { client: "holds: OrderRepository" },
      code: "client",
    },
    {
      title: "Two implementations satisfy the same contract",
      description:
        "SqlOrderRepository and InMemoryOrderRepository both implement OrderRepository, which is exactly what lets either one be handed to OrderService without it noticing.",
      highlight: [
        "orderRepository",
        "sqlOrderRepository",
        "sqlImpl",
        "inMemoryOrderRepository",
        "memImpl",
      ],
      notes: { orderRepository: "findById, findByCustomer, add, save, remove" },
      code: "orderRepository",
    },
    {
      title: "Production code calls findById",
      description:
        "Wired to the real SqlOrderRepository, OrderService asks for order #482 exactly the way it would ask any OrderRepository.",
      highlight: ["client", "find", "sqlOrderRepository"],
      packets: [{ relation: "find", label: "findById(482)" }],
      notes: { client: "needs order 482" },
      code: "client",
    },
    {
      title: "Repository builds a SQL query",
      description:
        "SqlOrderRepository.findById() turns the request into a parameterized SELECT and sends it to the Database.",
      highlight: ["sqlOrderRepository", "query", "database"],
      packets: [{ relation: "query", label: "SELECT … FROM orders WHERE id = ? [482]" }],
      notes: { database: "running query" },
      code: "findById",
    },
    {
      title: "Database returns raw rows",
      description:
        "The Database executes the statement and hands back a plain row — untyped data with no knowledge of the Order class or the domain at all.",
      highlight: ["database", "query", "sqlOrderRepository"],
      packets: [{ relation: "query", label: "{id, customer_id, total_cents}", reverse: true }],
      notes: { sqlOrderRepository: "1 row" },
      code: "findById",
    },
    {
      title: "Row is mapped into a domain object",
      description:
        "Before returning anything, the repository maps the raw row into a real Order instance, so SQL and column names never leak past this boundary.",
      highlight: ["sqlOrderRepository", "map", "order"],
      packets: [{ relation: "map", label: "new Order(row)" }],
      notes: { order: "Order #482" },
      code: "mapRow",
    },
    {
      title: "Domain object flows back to the service",
      description:
        "OrderService receives a plain Order object. It never saw a row, a column name, or a SQL statement — only the collection-like interface it already knew.",
      highlight: ["sqlOrderRepository", "find", "client"],
      packets: [{ relation: "find", label: "Order #482", reverse: true }],
      notes: { client: "got Order #482" },
      code: "client",
    },
    {
      title: "Swapped for an in-memory repository in tests",
      description:
        "A unit test constructs the very same OrderService with an InMemoryOrderRepository instead. findById() now reads straight out of an in-memory map — no database, no SQL — and OrderService does not change at all.",
      highlight: ["client", "find", "inMemoryOrderRepository", "memImpl", "memHolds", "order"],
      packets: [{ relation: "memHolds", label: "orders.get(482)" }],
      notes: { inMemoryOrderRepository: "test double" },
      code: "inMemoryOrderRepository",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Generic diagram is used — no custom Visualization.
};
