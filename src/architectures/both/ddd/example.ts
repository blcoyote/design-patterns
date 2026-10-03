// [money]
/** Immutable value object: no identity, compared by value, every operation returns a new instance. */
class Money {
  private constructor(
    private readonly cents: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency = "USD"): Money {
    const scaled = amount * 100;
    const cents = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  toString(): string {
    return `${(this.cents / 100).toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new Error("currency mismatch");
  }
}
// [/money]

// [orderLine]
/** Value object: no identity of its own and never changes after creation — two lines with the same sku, price and quantity are interchangeable. */
class OrderLine {
  constructor(
    readonly sku: string,
    readonly unitPrice: Money,
    readonly quantity: number,
  ) {}

  get lineTotal(): Money {
    let total = Money.of(0, this.unitPrice.currency);
    for (let i = 0; i < this.quantity; i++) total = total.add(this.unitPrice);
    return total;
  }
}
// [/orderLine]

// [orderPlaced]
interface DomainEvent {
  readonly name: string;
  readonly occurredAt: Date;
}

/** Domain event: something that happened inside the Ordering bounded context. */
class OrderPlaced implements DomainEvent {
  readonly name = "OrderPlaced";
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly customerId: string,
    readonly total: Money,
  ) {}
}
// [/orderPlaced]

/** Strategy: a domain policy injected into the aggregate instead of hardcoded inside it. */
interface OrderPolicy {
  isSatisfiedBy(order: Order): boolean;
  describe(): string;
}

class RequireAtLeastOneLine implements OrderPolicy {
  isSatisfiedBy(order: Order): boolean {
    return order.lineCount > 0;
  }
  describe(): string {
    return "an order needs at least one line to be placed";
  }
}

type OrderStatus = "draft" | "placed";

// [order]
/** Aggregate root: the only object outside the aggregate is allowed to reference directly. */
class Order {
  readonly id: string;
  readonly customerId: string;
  private status: OrderStatus = "draft";
  private readonly lines: OrderLine[] = [];
  private readonly events: DomainEvent[] = [];

  private constructor(id: string, customerId: string) {
    this.id = id;
    this.customerId = customerId;
  }

  // Factory (Evans): a static creation method, so callers never build an Order with `new` directly.
  static create(id: string, customerId: string): Order {
    return new Order(id, customerId);
  }

  get lineCount(): number {
    return this.lines.length;
  }

  addLine(line: OrderLine): void {
    // Invariant: a placed order can never be grown again — no matter who calls this,
    // or from where. The rule lives in the aggregate, not in every caller.
    if (this.status !== "draft") {
      throw new Error(`cannot add a line to order ${this.id}: already ${this.status}`);
    }
    this.lines.push(line);
  }

  get total(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.lineTotal), Money.of(0));
  }

  place(policy: OrderPolicy): void {
    if (this.status !== "draft") throw new Error(`order ${this.id} is already ${this.status}`);
    if (!policy.isSatisfiedBy(this))
      throw new Error(`cannot place order ${this.id}: ${policy.describe()}`);
    this.status = "placed";
    this.events.push(new OrderPlaced(this.id, this.customerId, this.total));
  }

  /** Events raised since the last call. The aggregate itself never publishes anything. */
  pullEvents(): DomainEvent[] {
    const pulled = [...this.events];
    this.events.length = 0;
    return pulled;
  }
}
// [/order]

// [orderRepo]
/** Repository: a collection-like abstraction for loading and saving whole aggregates. */
interface OrderRepository {
  findById(id: string): Order | undefined;
  save(order: Order): void;
}

class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }
}
// [/orderRepo]

// [shipping]
// Shipping bounded context: its own vocabulary. It has never heard of an "Order".
// Money and the domain-event interface are the only types it shares with Ordering —
// a deliberately tiny shared kernel.
class ShipmentRequested implements DomainEvent {
  readonly name = "ShipmentRequested";
  readonly occurredAt = new Date();
  constructor(
    readonly shipmentId: string,
    readonly recipientId: string,
    readonly value: Money,
  ) {}
}

class ShippingService {
  requestShipment(event: ShipmentRequested): void {
    console.log(
      `[shipping] shipment ${event.shipmentId} requested for ${event.recipientId}, value ${event.value}`,
    );
  }
}
// [/shipping]

// [acl]
// Anti-Corruption Layer: conceptually owned by the downstream Shipping context. It
// translates upstream Ordering's language into Shipping's own, so Ordering's model
// never leaks into Shipping. OrderPlaced never crosses the boundary as-is — only
// ShipmentRequested does.
class OrderingToShippingAcl {
  constructor(private readonly shipping: ShippingService) {}

  translate(event: OrderPlaced): void {
    const shipmentRequested = new ShipmentRequested(
      `ship-${event.orderId}`,
      event.customerId,
      event.total,
    );
    this.shipping.requestShipment(shipmentRequested);
  }
}
// [/acl]

// [appService]
/** Application service: Ordering's single entry point. No business rules of its own. */
class OrderApplicationService {
  private readonly policy: OrderPolicy = new RequireAtLeastOneLine();

  constructor(
    private readonly repository: OrderRepository,
    private readonly acl: OrderingToShippingAcl,
  ) {}

  startOrder(id: string, customerId: string): Order {
    const order = Order.create(id, customerId);
    this.repository.save(order);
    return order;
  }

  placeOrder(orderId: string, lines: OrderLine[]): Order {
    const order = this.repository.findById(orderId);
    if (!order) throw new Error(`no such order: ${orderId}`);

    for (const line of lines) order.addLine(line);
    order.place(this.policy);
    this.repository.save(order);

    // The application service plays observer: it collects what the aggregate raised
    // in-process, and dispatches each event onward — here, straight through the ACL.
    for (const event of order.pullEvents()) {
      if (event instanceof OrderPlaced) this.acl.translate(event);
    }
    return order;
  }
}
// [/appService]

// Usage
const repository = new InMemoryOrderRepository();
const acl = new OrderingToShippingAcl(new ShippingService());
const appService = new OrderApplicationService(repository, acl);

const draft = appService.startOrder("order-1", "cust-42");
const placed = appService.placeOrder(draft.id, [
  new OrderLine("WIDGET", Money.of(19.99), 2),
  new OrderLine("GADGET", Money.of(29.99), 1),
]);
console.log(`order ${placed.id} placed, total: ${placed.total}`);

// Invariant in action: the aggregate refuses to grow once it has been placed.
try {
  placed.addLine(new OrderLine("LATE-ITEM", Money.of(5), 1));
} catch (err) {
  console.log(`rejected: ${(err as Error).message}`);
}
