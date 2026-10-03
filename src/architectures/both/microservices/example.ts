interface OrderLine {
  sku: string;
  quantity: number;
}

interface PlaceOrderCommand {
  lines: OrderLine[];
}

/** Orders' own model of a product -- only what Orders needs, in Orders' own vocabulary. */
interface Product {
  sku: string;
  name: string;
  price: number;
}

interface OrderPlacedEvent {
  orderId: string;
  lines: OrderLine[];
  total: number;
}

// [inventory]
/** Inventory's own wire shape. Orders never sees this directly -- only through the client below. */
interface ProductDto {
  sku: string;
  displayName: string;
  unitPriceCents: number;
}

/** The Inventory microservice: stands in for a separate process with its own private store. */
class InventoryService {
  calls = 0;
  private readonly products = new Map<string, ProductDto>([
    ["sku-1", { sku: "sku-1", displayName: "Widget", unitPriceCents: 1999 }],
    ["sku-2", { sku: "sku-2", displayName: "Gadget", unitPriceCents: 2999 }],
  ]);

  findProduct(sku: string): ProductDto {
    this.calls++;
    const dto = this.products.get(sku);
    if (!dto) throw new Error(`product ${sku} not found`);
    return dto;
  }
}
// [/inventory]

// [inventoryClient]
/**
 * Orders' client proxy for Inventory: same interface shape Orders would use for a local
 * call, so Orders never deals with Inventory's transport directly (Proxy). It also checks
 * its own cache before calling out (Cache-Aside), and converts Inventory's ProductDto
 * into Orders' own Product model (Adapter) so Inventory's wire shape never leaks in.
 */
class InventoryServiceClient {
  private readonly cache = new Map<string, Product>();

  constructor(private readonly inventory: InventoryService) {}

  getProduct(sku: string): Product {
    const cached = this.cache.get(sku);
    if (cached) return cached; // cache hit -- Inventory is never called

    const dto = this.inventory.findProduct(sku); // cache miss -- load from the service
    const product: Product = {
      sku: dto.sku,
      name: dto.displayName,
      price: dto.unitPriceCents / 100,
    };
    this.cache.set(sku, product); // populate the cache for next time
    return product;
  }
}
// [/inventoryClient]

// [breaker]
type BreakerState = "CLOSED" | "OPEN";

/**
 * A deliberately minimal circuit breaker: no timers, no clock -- just a failure counter.
 * Once `failureThreshold` calls in a row have failed it opens and stays open, failing
 * every further call immediately without ever invoking `fn` again.
 */
class CircuitBreaker {
  private state: BreakerState = "CLOSED";
  private failureCount = 0;

  constructor(private readonly failureThreshold: number) {}

  call<T>(fn: () => T): T {
    if (this.state === "OPEN") {
      throw new Error("circuit open -- failing fast"); // fn() never runs
    }
    try {
      const result = fn();
      this.failureCount = 0;
      return result;
    } catch (err) {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) this.state = "OPEN";
      throw err;
    }
  }

  get isOpen(): boolean {
    return this.state === "OPEN";
  }
}
// [/breaker]

// [payments]
/** The Payments microservice: stands in for a separate process with its own private store. */
class PaymentsService {
  calls = 0;
  private down = false;

  /** Flips the processor's health. Deterministic: only ever changed by an explicit call, never a timer. */
  setDown(down: boolean): void {
    this.down = down;
  }

  charge(orderId: string, amount: number): string {
    this.calls++;
    if (this.down) throw new Error(`payment processor unavailable for order ${orderId}`);
    return `receipt-${orderId}-${amount}`;
  }
}
// [/payments]

// [broker]
type OrderPlacedHandler = (event: OrderPlacedEvent) => void;

/** A simple in-process broker: publishers and subscribers only ever know this interface (Pub/Sub). */
class MessageBroker {
  private readonly subscribers: OrderPlacedHandler[] = [];

  subscribe(handler: OrderPlacedHandler): void {
    this.subscribers.push(handler);
  }

  publish(event: OrderPlacedEvent): void {
    for (const handler of this.subscribers) handler(event);
  }
}
// [/broker]

// [shipping]
/** The Shipping microservice. It only ever learns about an order by subscribing to the broker. */
class ShippingService {
  readonly received: OrderPlacedEvent[] = [];

  onOrderPlaced(event: OrderPlacedEvent): void {
    this.received.push(event);
  }
}
// [/shipping]

type OrderStatus = "PAID" | "PAYMENT_FAILED";

interface OrderRecord {
  orderId: string;
  total: number;
  status: OrderStatus;
}

interface PlaceOrderResult {
  orderId: string;
  total: number;
  status: OrderStatus;
  /** Empty string when the order was paid. */
  reason: string;
}

// [orders]
/** The Orders microservice: stands in for a separate process, with its own private store of the orders it has recorded. */
class OrderService {
  private readonly orders = new Map<string, OrderRecord>();
  private nextOrderId = 1; // Orders owns its own ids: counter-based, never timestamps

  constructor(
    private readonly inventoryClient: InventoryServiceClient,
    private readonly paymentsBreaker: CircuitBreaker,
    private readonly payments: PaymentsService,
    private readonly broker: MessageBroker,
  ) {}

  placeOrder(command: PlaceOrderCommand): PlaceOrderResult {
    const orderId = `order-${this.nextOrderId++}`;
    let total = 0;
    for (const line of command.lines) {
      const product = this.inventoryClient.getProduct(line.sku);
      total += product.price * line.quantity;
    }

    let status: OrderStatus;
    let reason = "";
    try {
      this.paymentsBreaker.call(() => this.payments.charge(orderId, total));
      status = "PAID";
    } catch (err) {
      status = "PAYMENT_FAILED";
      reason = (err as Error).message;
    }

    // Orders records every order it handled in its own private store, paid or not.
    this.orders.set(orderId, { orderId, total, status });

    // Only a paid order is announced -- a failed one never reaches Shipping.
    if (status === "PAID") this.broker.publish({ orderId, lines: command.lines, total });

    return { orderId, total, status, reason };
  }

  get recordedOrders(): OrderRecord[] {
    return [...this.orders.values()];
  }
}
// [/orders]

// [gateway]
/** The API Gateway: the one entry point clients see, hiding the services behind it (Facade). It only forwards -- no business logic, not even order ids. */
class ApiGateway {
  constructor(private readonly orders: OrderService) {}

  placeOrder(lines: OrderLine[]): PlaceOrderResult {
    return this.orders.placeOrder({ lines });
  }
}
// [/gateway]

// [usage]
const inventory = new InventoryService();
const inventoryClient = new InventoryServiceClient(inventory);
const payments = new PaymentsService();
const paymentsBreaker = new CircuitBreaker(/* failureThreshold */ 3);
const broker = new MessageBroker();
const shipping = new ShippingService();
broker.subscribe((event) => shipping.onOrderPlaced(event));
const orders = new OrderService(inventoryClient, paymentsBreaker, payments, broker);
const gateway = new ApiGateway(orders);

function report(order: PlaceOrderResult): void {
  console.log(
    `${order.orderId}: total=$${order.total.toFixed(2)} status=${order.status} reason="${order.reason}"`,
  );
}

// Order 1: two lines, same sku -- the second lookup is a cache hit. Payments is healthy, so it is paid.
report(
  gateway.placeOrder([
    { sku: "sku-1", quantity: 1 },
    { sku: "sku-1", quantity: 2 },
  ]),
);

// The payment processor goes down -- deterministic, flipped explicitly, not by a timer.
payments.setDown(true);

// Orders 2, 3 and 4: the processor is down for all three, so the breaker counts three
// failures in a row and trips open on the third one.
report(gateway.placeOrder([{ sku: "sku-2", quantity: 1 }]));
report(gateway.placeOrder([{ sku: "sku-2", quantity: 1 }]));
report(gateway.placeOrder([{ sku: "sku-1", quantity: 1 }]));
console.log(
  `PaymentsService calls so far: ${payments.calls}, breaker=${paymentsBreaker.isOpen ? "OPEN" : "CLOSED"}`,
);

// Order 5: the breaker is now open -- it fails fast, PaymentsService.charge is never called.
report(gateway.placeOrder([{ sku: "sku-2", quantity: 1 }]));
console.log(`PaymentsService calls after breaker opened: ${payments.calls}`);

console.log(`InventoryService product lookups: ${inventory.calls}`);
console.log(
  `OrderService recorded ${orders.recordedOrders.length} orders, ${orders.recordedOrders.filter((o) => o.status === "PAID").length} paid`,
);
console.log(`ShippingService received ${shipping.received.length} OrderPlaced events`);
// [/usage]
