// [events]
interface OrderPlaced {
  readonly orderId: number;
  readonly item: string;
  readonly quantity: number;
}

interface StockReserved {
  readonly orderId: number;
  readonly item: string;
}
// [/events]

// [broker]
type Handler = (event: unknown) => void;

interface QueuedMessage {
  topic: string;
  event: unknown;
}

/**
 * Broker: keeps a list of handlers per topic and an explicit, drainable queue.
 * Publishing only enqueues a message — it never calls a handler directly, and
 * draining is FIFO, so delivery order is deterministic and identical across languages.
 */
class EventBroker {
  private readonly subscribers = new Map<string, Handler[]>();
  private readonly queue: QueuedMessage[] = [];

  subscribe(topic: string, handler: Handler): void {
    const handlers = this.subscribers.get(topic) ?? [];
    handlers.push(handler);
    this.subscribers.set(topic, handlers);
  }

  publish(topic: string, event: unknown): void {
    // The publisher only knows a topic name, never a handler — adding or removing
    // a subscriber never requires touching this method or its caller.
    this.queue.push({ topic, event });
  }

  /** Drains the queue FIFO, including messages a handler enqueues while draining (choreography). */
  drain(): void {
    while (this.queue.length > 0) {
      const message = this.queue.shift()!;
      const handlers = this.subscribers.get(message.topic) ?? [];
      for (const handler of handlers) handler(message.event);
    }
  }
}
// [/broker]

// [dedupe]
/**
 * Consumer-side handler pipeline (a tiny Chain of Responsibility): wraps a handler so a
 * redelivered message with an orderId already seen is dropped before it reaches the
 * real handler. This lives on the consumer, not the broker — the broker has no idea
 * deduplication is happening.
 */
function dedupe(handler: Handler): Handler {
  const seen = new Set<number>();
  return (event: unknown) => {
    const { orderId } = event as OrderPlaced;
    if (seen.has(orderId)) {
      console.log(`[inventory] duplicate OrderPlaced(${orderId}) ignored`);
      return;
    }
    seen.add(orderId);
    handler(event);
  };
}
// [/dedupe]

// [email]
class EmailConsumer {
  onOrderPlaced(event: OrderPlaced): void {
    console.log(
      `[email] confirmation sent for order ${event.orderId} (${event.quantity} x ${event.item})`,
    );
  }
}
// [/email]

// [inventory]
class InventoryConsumer {
  constructor(private readonly broker: EventBroker) {}

  onOrderPlaced(event: OrderPlaced): void {
    console.log(
      `[inventory] reserved ${event.quantity} x ${event.item} for order ${event.orderId}`,
    );
    // Choreography: Inventory decides on its own to publish the next event — nothing
    // orchestrates this, and the broker itself has no idea what topic comes next.
    const stockReserved: StockReserved = { orderId: event.orderId, item: event.item };
    this.broker.publish("StockReserved", stockReserved);
  }
}
// [/inventory]

// [analytics]
class AnalyticsConsumer {
  private count = 0;

  onOrderPlaced(_event: OrderPlaced): void {
    this.count += 1;
    console.log(`[analytics] order count: ${this.count}`);
  }
}
// [/analytics]

// [loyalty]
// Added after the system is already running, subscribing to the exact same topic.
// OrdersProducer below is never touched to make this consumer exist.
class LoyaltyConsumer {
  onOrderPlaced(event: OrderPlaced): void {
    console.log(`[loyalty] points awarded for order ${event.orderId}`);
  }
}
// [/loyalty]

// [producer]
class OrdersProducer {
  private nextOrderId = 1;

  constructor(private readonly broker: EventBroker) {}

  placeOrder(item: string, quantity: number): number {
    const orderId = this.nextOrderId++;
    const event: OrderPlaced = { orderId, item, quantity };
    // The producer depends on the broker and a topic name only — not on a single
    // consumer, and not on how many consumers (zero or a dozen) are listening.
    this.broker.publish("OrderPlaced", event);
    return orderId;
  }

  /** Simulates an at-least-once broker redelivering a message it already delivered once. */
  redeliver(orderId: number, item: string, quantity: number): void {
    const event: OrderPlaced = { orderId, item, quantity };
    this.broker.publish("OrderPlaced", event);
  }
}
// [/producer]

// Usage
// [usage]
const broker = new EventBroker();
const email = new EmailConsumer();
const inventory = new InventoryConsumer(broker);
const analytics = new AnalyticsConsumer();

broker.subscribe("OrderPlaced", (e) => email.onOrderPlaced(e as OrderPlaced));
broker.subscribe(
  "OrderPlaced",
  dedupe((e) => inventory.onOrderPlaced(e as OrderPlaced)),
);
broker.subscribe("OrderPlaced", (e) => analytics.onOrderPlaced(e as OrderPlaced));

const producer = new OrdersProducer(broker);

const orderId = producer.placeOrder("WIDGET", 2);
broker.drain();

// At-least-once redelivery: Inventory's dedupe pipeline recognizes order 1 and drops
// it; Email and Analytics have no such pipeline, so they process it again.
producer.redeliver(orderId, "WIDGET", 2);
broker.drain();

// Adding a consumer requires no change to OrdersProducer, EventBroker, or any other
// consumer — only a new subscribe() call.
const loyalty = new LoyaltyConsumer();
broker.subscribe("OrderPlaced", (e) => loyalty.onOrderPlaced(e as OrderPlaced));

producer.placeOrder("GADGET", 1);
broker.drain();
// [/usage]
