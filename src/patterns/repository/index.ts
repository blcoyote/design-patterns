import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'repository',
  name: 'Repository',
  category: 'architectural',
  order: 2,
  summary: 'Hide persistence behind a collection-like interface so domain code never sees SQL.',
  intent:
    'Mediate between the domain/application layer and the data store with an interface that looks like an in-memory collection of objects — findById, findByCustomer, add, remove — so the rest of the application can work with domain objects without knowing how, or where, they are actually stored.',
  problem:
    'Without a boundary, SQL strings, ORM query builders and connection handling creep into services and controllers, so every piece of code that needs an Order ends up knowing the shape of the orders table. The same query gets copy-pasted in three places, unit tests require a real database just to exercise business logic, and swapping or upgrading the data store means hunting down every call site that touches it.',
  solution:
    'Define a Repository interface shaped like a collection of domain objects, and put exactly one concrete class behind it that knows how to talk to the real store — building SQL, executing it, and mapping rows back into fully-formed domain objects. Application code is constructed against the interface only, so a SqlOrderRepository can be swapped for an InMemoryOrderRepository in tests, or for a different store entirely later, without changing a single caller.',
  analogy:
    'A library catalogue desk: you ask for "the 2023 edition of this title" and get a book back. You never find out whether it came off the open shelves, a back-room archive, or an inter-library loan — the request looks the same either way, because the desk hides where the books actually live.',
  whenToUse: [
    'Domain or application logic is becoming entangled with SQL, ORM query builders, or other storage-specific APIs.',
    'You want to unit test business logic without spinning up a real database.',
    'Several parts of the app need the same queries and you want them defined once instead of copy-pasted.',
    'You expect to change or add a data store later (SQL today, a cache or a different engine tomorrow) without rewriting every caller.',
  ],
  pros: [
    'Isolates persistence details behind a small, collection-like interface.',
    'Makes domain and application logic trivially testable with an in-memory fake instead of a real database.',
    'Centralizes query logic in one place so it is not duplicated across services.',
    'Swapping data stores means writing a new repository, not rewriting every consumer.',
  ],
  cons: [
    'Can become a leaky abstraction once real query needs (filtering, pagination, joins) force the interface to balloon.',
    'Adds a layer of indirection that simple, single-datastore CRUD apps may never actually need.',
    'Can hide performance-relevant details — N+1 queries, missing indexes — behind a deceptively simple-looking call.',
  ],
  realWorld: [
    'Spring Data JPA repository interfaces, implemented automatically from method name conventions',
    'Entity Framework / DDD-style repository classes wrapping a DbContext in .NET codebases',
    'TypeORM and Doctrine repository classes, one per entity',
    'Hand-rolled repository classes in Rails or Django apps that keep ActiveRecord/ORM calls out of controllers',
  ],
  related: ['unit-of-work', 'facade', 'adapter', 'dependency-injection'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'client',
      label: 'OrderService',
      role: 'Client',
      kind: 'client',
      x: 110,
      y: 230,
      width: 160,
      description: 'Application/domain service that needs orders. It is constructed with something typed as OrderRepository and never knows which concrete class sits behind it.',
    },
    {
      id: 'orderRepository',
      label: 'OrderRepository',
      role: 'Repository interface',
      kind: 'interface',
      x: 400,
      y: 90,
      width: 230,
      description: 'Declares a collection-like contract — findById, findByCustomer, add, remove — expressed purely in terms of domain objects, with no hint of SQL or any other storage technology.',
    },
    {
      id: 'sqlOrderRepository',
      label: 'SqlOrderRepository',
      role: 'Concrete Repository',
      kind: 'class',
      x: 650,
      y: 230,
      width: 190,
      description: 'Implements OrderRepository against a real Database: builds SQL for each method, executes it, and maps the resulting rows into Order domain objects.',
    },
    {
      id: 'database',
      label: 'Database',
      role: 'Data source',
      kind: 'class',
      x: 400,
      y: 230,
      width: 140,
      description: 'A thin stand-in for a real database connection. It only understands query(sql, params) and returns plain, untyped rows — it has no concept of an Order.',
    },
    {
      id: 'order',
      label: 'Order',
      role: 'Domain object',
      kind: 'object',
      x: 400,
      y: 390,
      width: 140,
      description: 'A plain domain object with no persistence logic of its own. Both repository implementations produce and hand back instances of this same class.',
    },
    {
      id: 'inMemoryOrderRepository',
      label: 'InMemoryOrderRepository',
      role: 'Concrete Repository (test double)',
      kind: 'class',
      x: 650,
      y: 390,
      width: 220,
      description: 'Implements the same OrderRepository interface backed by a plain Map instead of a database — used in unit tests so business logic can run with no real storage at all.',
    },
  ],
  relations: [
    {
      id: 'find',
      from: 'client',
      to: 'orderRepository',
      type: 'calls',
      label: 'findById(id)',
      description: 'OrderService calls findById() on whatever it was handed, through the OrderRepository type — it never references a concrete repository class directly.',
      bend: 10,
      code: 'client',
    },
    {
      id: 'sqlImpl',
      from: 'sqlOrderRepository',
      to: 'orderRepository',
      type: 'implements',
      description: 'SqlOrderRepository implements OrderRepository so it can be handed to OrderService anywhere one is expected.',
      bend: 25,
      code: 'sqlOrderRepository',
    },
    {
      id: 'memImpl',
      from: 'inMemoryOrderRepository',
      to: 'orderRepository',
      type: 'implements',
      description: 'InMemoryOrderRepository implements the exact same interface, which is what lets it stand in for the SQL repository in tests.',
      bend: -30,
      code: 'inMemoryOrderRepository',
    },
    {
      id: 'query',
      from: 'sqlOrderRepository',
      to: 'database',
      type: 'calls',
      label: 'query(sql, params)',
      description: 'findById() translates the request into a parameterized SQL statement and sends it to the Database, which has no idea an Order exists.',
      code: 'findById',
    },
    {
      id: 'map',
      from: 'sqlOrderRepository',
      to: 'order',
      type: 'creates',
      label: 'new Order(row)',
      description: 'The raw row that comes back from the Database is mapped into a fully-typed Order before it ever leaves the repository.',
      code: 'mapRow',
    },
    {
      id: 'memHolds',
      from: 'inMemoryOrderRepository',
      to: 'order',
      type: 'holds',
      label: 'Map<id, Order>',
      description: 'The in-memory repository keeps Order instances directly in a Map, so a lookup is just orders.get(id) — no SQL, no mapping step.',
      code: 'inMemoryOrderRepository',
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'Service depends only on the interface',
      description: 'OrderService is constructed with a repo typed as OrderRepository. Its code never mentions SqlOrderRepository or InMemoryOrderRepository by name.',
      highlight: ['client', 'find', 'orderRepository'],
      notes: { client: 'holds: OrderRepository' },
      code: 'client',
    },
    {
      title: 'Two implementations satisfy the same contract',
      description: 'SqlOrderRepository and InMemoryOrderRepository both implement OrderRepository, which is exactly what lets either one be handed to OrderService without it noticing.',
      highlight: ['orderRepository', 'sqlOrderRepository', 'sqlImpl', 'inMemoryOrderRepository', 'memImpl'],
      notes: { orderRepository: 'findById, findByCustomer, add, remove' },
      code: 'orderRepository',
    },
    {
      title: 'Production code calls findById',
      description: 'Wired to the real SqlOrderRepository, OrderService asks for order #482 exactly the way it would ask any OrderRepository.',
      highlight: ['client', 'find', 'sqlOrderRepository'],
      packets: [{ relation: 'find', label: 'findById(482)' }],
      notes: { client: 'needs order 482' },
      code: 'client',
    },
    {
      title: 'Repository builds a SQL query',
      description: 'SqlOrderRepository.findById() turns the request into a parameterized SELECT and sends it to the Database.',
      highlight: ['sqlOrderRepository', 'query', 'database'],
      packets: [{ relation: 'query', label: 'SELECT … FROM orders WHERE id = ? [482]' }],
      notes: { database: 'running query' },
      code: 'findById',
    },
    {
      title: 'Database returns raw rows',
      description: 'The Database executes the statement and hands back a plain row — untyped data with no knowledge of the Order class or the domain at all.',
      highlight: ['database', 'query', 'sqlOrderRepository'],
      packets: [{ relation: 'query', label: '{id, customer_id, total_cents}', reverse: true }],
      notes: { sqlOrderRepository: '1 row' },
      code: 'findById',
    },
    {
      title: 'Row is mapped into a domain object',
      description: 'Before returning anything, the repository maps the raw row into a real Order instance, so SQL and column names never leak past this boundary.',
      highlight: ['sqlOrderRepository', 'map', 'order'],
      packets: [{ relation: 'map', label: 'new Order(row)' }],
      notes: { order: 'Order #482' },
      code: 'mapRow',
    },
    {
      title: 'Domain object flows back to the service',
      description: 'OrderService receives a plain Order object. It never saw a row, a column name, or a SQL statement — only the collection-like interface it already knew.',
      highlight: ['sqlOrderRepository', 'find', 'client'],
      packets: [{ relation: 'find', label: 'Order #482', reverse: true }],
      notes: { client: 'got Order #482' },
      code: 'client',
    },
    {
      title: 'Swapped for an in-memory repository in tests',
      description: 'A unit test constructs the very same OrderService with an InMemoryOrderRepository instead. findById() now reads straight out of a Map — no database, no SQL — and OrderService does not change at all.',
      highlight: ['client', 'find', 'inMemoryOrderRepository', 'memImpl', 'memHolds', 'order'],
      packets: [{ relation: 'memHolds', label: 'orders.get(482)' }],
      notes: { inMemoryOrderRepository: 'test double' },
      code: 'inMemoryOrderRepository',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: `
// [order]
class Order {
  constructor(
    public readonly id: string,
    public readonly customerId: string,
    public readonly total: number,
  ) {}
}
// [/order]

// [orderRepository]
interface OrderRepository {
  findById(id: string): Order | undefined
  findByCustomer(customerId: string): Order[]
  add(order: Order): void
  save(order: Order): void // persists changes to an already-added Order (an upsert)
  remove(id: string): void
}
// [/orderRepository]

// [database]
class Database {
  query(sql: string, params: unknown[]): Record<string, unknown>[] {
    console.log('SQL:', sql, params)
    return [{ id: '482', customer_id: 'cst-9', total_cents: 4200 }]
  }
}
// [/database]

// [sqlOrderRepository]
class SqlOrderRepository implements OrderRepository {
  constructor(private db: Database) {}

  // [findById]
  findById(id: string): Order | undefined {
    const rows = this.db.query('SELECT * FROM orders WHERE id = ?', [id])
    return rows[0] ? this.mapRow(rows[0]) : undefined
  }
  // [/findById]

  findByCustomer(customerId: string): Order[] {
    const rows = this.db.query('SELECT * FROM orders WHERE customer_id = ?', [customerId])
    return rows.map((row) => this.mapRow(row))
  }

  add(order: Order): void {
    this.db.query('INSERT INTO orders (id, customer_id, total_cents) VALUES (?, ?, ?)', [
      order.id,
      order.customerId,
      Math.round(order.total * 100),
    ])
  }

  save(order: Order): void {
    // An update path for an Order already added — see the Unit of Work pattern
    // for batching several such changes into a single transaction.
    this.db.query('UPDATE orders SET customer_id = ?, total_cents = ? WHERE id = ?', [
      order.customerId,
      Math.round(order.total * 100),
      order.id,
    ])
  }

  remove(id: string): void {
    this.db.query('DELETE FROM orders WHERE id = ?', [id])
  }

  // [mapRow]
  private mapRow(row: Record<string, unknown>): Order {
    return new Order(row.id as string, row.customer_id as string, (row.total_cents as number) / 100)
  }
  // [/mapRow]
}
// [/sqlOrderRepository]

// [inMemoryOrderRepository]
class InMemoryOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>()

  findById(id: string): Order | undefined {
    return this.orders.get(id)
  }

  findByCustomer(customerId: string): Order[] {
    return [...this.orders.values()].filter((order) => order.customerId === customerId)
  }

  add(order: Order): void {
    this.orders.set(order.id, order)
  }

  save(order: Order): void {
    this.orders.set(order.id, order) // Map.set already overwrites, so add and save coincide here
  }

  remove(id: string): void {
    this.orders.delete(id)
  }
}
// [/inMemoryOrderRepository]

// [client]
class OrderService {
  constructor(private repo: OrderRepository) {}

  getReceipt(orderId: string): string {
    const order = this.repo.findById(orderId)
    return order ? \`Order \${order.id}: $\${order.total.toFixed(2)}\` : 'not found'
  }
}
// [/client]

// [usage]
// Production: wired to the real database
const service = new OrderService(new SqlOrderRepository(new Database()))
console.log(service.getReceipt('482'))

// Tests: the exact same service, wired to an in-memory stand-in — no database involved
const fakeRepo = new InMemoryOrderRepository()
fakeRepo.add(new Order('482', 'cst-9', 42))
const testService = new OrderService(fakeRepo)
console.log(testService.getReceipt('482')) // reads straight out of the Map, no SQL involved
// [/usage]
`,

  // Generic diagram is used — no custom Visualization.
}
