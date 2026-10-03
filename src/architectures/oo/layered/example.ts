interface LineItem {
  sku: string
  price: number
}

// [order]
class Order {
  readonly lines: LineItem[] = []

  constructor(public readonly customerId: string) {}

  addLine(item: LineItem): void {
    if (item.price <= 0) throw new Error('line item must have a positive price')
    this.lines.push(item)
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.price, 0)
  }
}
// [/order]

interface OrderRepository {
  save(order: Order): void
}

// [save]
class SqlOrderRepository implements OrderRepository {
  save(order: Order): void {
    databaseQuery(`INSERT INTO orders (customer_id, total) VALUES ('${order.customerId}', ${order.total})`)
  }
}
// [/save]

// [placeOrder]
class OrderService {
  constructor(private repository: OrderRepository) {}

  placeOrder(customerId: string, items: LineItem[]): Order {
    const order = new Order(customerId)
    for (const item of items) order.addLine(item)
    this.repository.save(order)
    return order
  }
}
// [/placeOrder]

// [controller]
class OrderController {
  constructor(private service: OrderService) {}

  handlePlaceOrder(customerId: string, items: LineItem[]): { status: number; customerId: string } {
    const order = this.service.placeOrder(customerId, items)
    return { status: 201, customerId: order.customerId }
  }

  // [violation]
  // Anti-pattern: reaching straight past Application and Domain into Data access.
  // Nothing in a plain class stops this — only discipline and code review do.
  handleDebugLookup(id: string): unknown[] {
    return databaseQuery(`SELECT * FROM orders WHERE id = '${id}'`)
  }
  // [/violation]
}
// [/controller]

function databaseQuery(sql: string): unknown[] {
  console.log('SQL:', sql)
  return []
}

// Usage
const controller = new OrderController(new OrderService(new SqlOrderRepository()))
controller.handlePlaceOrder('cust-42', [
  { sku: 'WIDGET', price: 19.99 },
  { sku: 'GADGET', price: 29.99 },
])

// Anti-pattern in action: the controller reaches past three layers directly into the database.
controller.handleDebugLookup('42')
