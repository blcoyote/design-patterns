interface LineItem {
  sku: string;
  price: number;
}

interface PlaceOrderCommand {
  customerId: string;
  items: LineItem[];
}

// [port]
// Driving port: the only way into the core. Adapters depend on this
// interface; the core never depends on them.
interface PlaceOrderUseCase {
  execute(command: PlaceOrderCommand): Order;
}
// [/port]

// [order]
// Domain entity, part of the core. It knows nothing about HTTP, SQL or any
// adapter — only its own rules.
class Order {
  readonly lines: LineItem[] = [];

  constructor(public readonly customerId: string) {}

  addLine(item: LineItem): void {
    if (item.price <= 0) throw new Error("line item must have a positive price");
    this.lines.push(item);
  }

  get total(): number {
    return this.lines.reduce((sum, line) => sum + line.price, 0);
  }
}
// [/order]

// [repoPort]
// Driven port: the core declares the capability it needs, in its own
// vocabulary. It has no idea Postgres or an in-memory map will answer it.
interface OrderRepository {
  save(order: Order): void;
}
// [/repoPort]

// [service]
// The core's application service. It implements the driving port and
// depends only on the driven port's interface — never a concrete adapter.
class PlaceOrderService implements PlaceOrderUseCase {
  constructor(private readonly orders: OrderRepository) {}

  execute(command: PlaceOrderCommand): Order {
    const order = new Order(command.customerId);
    for (const item of command.items) order.addLine(item);
    this.orders.save(order);
    return order;
  }
}
// [/service]

// [postgres]
// Driven adapter #1: talks to a real database. Swappable because it is
// just another OrderRepository as far as the core is concerned.
class PostgresOrderRepository implements OrderRepository {
  save(order: Order): void {
    databaseQuery(
      `INSERT INTO orders (customer_id, total) VALUES ('${order.customerId}', ${order.total})`,
    );
  }
}
// [/postgres]

// [inMemory]
// Driven adapter #2: an in-memory stand-in used by tests. Same port, zero
// infrastructure, and the core cannot tell the difference.
class InMemoryOrderRepository implements OrderRepository {
  readonly saved: Order[] = [];

  save(order: Order): void {
    this.saved.push(order);
  }
}

// A true Null Object: same port, but it discards every write instead of
// keeping one. A safe, crash-free default for local development before a
// real adapter is wired in — unlike InMemoryOrderRepository, nothing can be
// read back out of it.
class NullOrderRepository implements OrderRepository {
  save(_order: Order): void {
    // intentionally does nothing
  }
}
// [/inMemory]

// [controller]
// Driving adapter: translates an inbound HTTP request into the command the
// driving port understands, and calls it. It depends on the port, never on
// PlaceOrderService directly.
class HttpOrderController {
  constructor(private readonly useCase: PlaceOrderUseCase) {}

  handlePost(body: { customerId: string; items: LineItem[] }): {
    status: number;
    customerId: string;
  } {
    const order = this.useCase.execute(body);
    return { status: 201, customerId: order.customerId };
  }
}
// [/controller]

function databaseQuery(sql: string): void {
  console.log("SQL:", sql);
}

// Usage: production wiring plugs the real database adapter into the core.
const controller = new HttpOrderController(new PlaceOrderService(new PostgresOrderRepository()));
controller.handlePost({
  customerId: "cust-42",
  items: [
    { sku: "WIDGET", price: 19.99 },
    { sku: "GADGET", price: 29.99 },
  ],
});

// [test]
// Test harness: the SAME PlaceOrderService, the SAME PlaceOrderUseCase port —
// only the driven adapter changes. The core is never touched, recompiled or
// mocked; it just receives a different implementation of OrderRepository.
function testPlaceOrderWritesToRepository(): void {
  const repo = new InMemoryOrderRepository();
  const useCase: PlaceOrderUseCase = new PlaceOrderService(repo);

  useCase.execute({ customerId: "cust-1", items: [{ sku: "WIDGET", price: 9.99 }] });

  if (repo.saved.length !== 1) throw new Error("expected exactly one saved order");
  console.log("test passed: order persisted through the in-memory adapter");
}

testPlaceOrderWritesToRepository();
// [/test]
