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
  save(order: Order): void // persists changes to an already-added Order
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
    return order ? `Order ${order.id}: $${order.total.toFixed(2)}` : 'not found'
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
