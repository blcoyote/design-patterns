interface OrderPlaced {
  orderId: string;
  total: number;
}

// One row of the outbox table. The id is a counter, so it is stable across retries.
interface OutboxMessage {
  id: number;
  topic: string;
  payload: OrderPlaced;
  published: boolean;
}

// [database]
// An in-memory stand-in for ONE relational database that holds both the
// business table (orders) and the outbox table.
class Transaction {
  orders: OrderPlaced[] = [];
  messages: { topic: string; payload: OrderPlaced }[] = [];

  insertOrder(order: OrderPlaced) {
    this.orders.push(order);
  }
  insertOutbox(topic: string, payload: OrderPlaced) {
    this.messages.push({ topic, payload });
  }
}

class Database {
  private orders: OrderPlaced[] = [];
  private outbox: OutboxMessage[] = [];
  private nextMessageId = 1;
  // Fault injection for the demo: the next markPublished() fails, as if the
  // relay lost its database connection right after publishing.
  failNextMark = false;

  // [transaction]
  // Stands in for BEGIN … COMMIT: the writes are staged and applied together
  // only if work() returns, so an exception leaves both tables untouched.
  transaction(work: (tx: Transaction) => void): void {
    const tx = new Transaction();
    work(tx);
    for (const order of tx.orders) {
      this.orders.push(order);
      console.log(`db: order ${order.orderId} saved`);
    }
    for (const { topic, payload } of tx.messages) {
      const row: OutboxMessage = { id: this.nextMessageId++, topic, payload, published: false };
      this.outbox.push(row);
      console.log(`db: outbox #${row.id} ${row.topic} pending`);
    }
  }
  // [/transaction]

  // [dbPending]
  // Oldest first; filter() returns a new array, so callers iterate a snapshot.
  pendingMessages(): OutboxMessage[] {
    return this.outbox.filter((message) => !message.published);
  }
  // [/dbPending]

  // [dbMark]
  markPublished(id: number): void {
    if (this.failNextMark) {
      this.failNextMark = false;
      throw new Error("database connection lost");
    }
    const row = this.outbox.find((message) => message.id === id);
    if (row) row.published = true;
  }
  // [/dbMark]
}
// [/database]

// [orderService]
class OrderService {
  constructor(private db: Database) {}

  placeOrder(orderId: string, total: number): void {
    // [placeOrder]
    // No broker call here. The event goes into the outbox table in the same
    // transaction as the order, so either both are saved or neither is.
    this.db.transaction((tx) => {
      tx.insertOrder({ orderId, total });
      tx.insertOutbox("order.placed", { orderId, total });
    });
    // [/placeOrder]
  }
}
// [/orderService]

// [messageBroker]
type Handler = (message: OutboxMessage) => void;

class MessageBroker {
  private handlers = new Map<string, Handler[]>();

  subscribe(topic: string, handler: Handler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler);
    this.handlers.set(topic, list);
  }

  publish(message: OutboxMessage): void {
    // [deliver]
    for (const handler of [...(this.handlers.get(message.topic) ?? [])]) {
      handler(message);
    }
    // [/deliver]
  }
}
// [/messageBroker]

// [outboxRelay]
class OutboxRelay {
  constructor(
    private db: Database,
    private broker: MessageBroker,
  ) {}

  // Called on a schedule in real systems; the usage below calls it by hand.
  poll(): void {
    // [relayPoll]
    const pending = this.db.pendingMessages();
    // [/relayPoll]
    if (pending.length === 0) {
      console.log("relay: nothing pending");
      return;
    }
    for (const message of pending) {
      try {
        // [relayPublish]
        this.broker.publish(message);
        // [/relayPublish]
        // [relayMark]
        // A failure between publish and mark leaves the row pending, so the
        // next poll publishes it again: delivery is at-least-once.
        this.db.markPublished(message.id);
        // [/relayMark]
        console.log(`relay: #${message.id} marked published`);
      } catch (e) {
        console.log(
          `relay: #${message.id} failed (${e instanceof Error ? e.message : String(e)}), stays pending`,
        );
        break; // keep order: don't publish later messages ahead of this one
      }
    }
  }
}
// [/outboxRelay]

// [shippingConsumer]
class ShippingConsumer {
  private handled = new Set<number>();

  constructor(broker: MessageBroker) {
    broker.subscribe("order.placed", (message) => this.onOrderPlaced(message));
  }

  private onOrderPlaced(message: OutboxMessage): void {
    // [dedupe]
    // At-least-once delivery means the same message can arrive twice, so the
    // consumer remembers the ids it has already handled.
    if (this.handled.has(message.id)) {
      console.log(`shipping: message ${message.id} already handled, ignored`);
      return;
    }
    this.handled.add(message.id);
    // [/dedupe]
    console.log(`shipping: ship order ${message.payload.orderId} (message ${message.id})`);
  }
}
// [/shippingConsumer]

// [client]
const db = new Database();
const broker = new MessageBroker();
const orders = new OrderService(db);
const relay = new OutboxRelay(db, broker);
new ShippingConsumer(broker);

orders.placeOrder("A1", 42);
// db: order A1 saved
// db: outbox #1 order.placed pending

db.failNextMark = true; // the relay publishes #1, then loses its connection
relay.poll();
// shipping: ship order A1 (message 1)
// relay: #1 failed (database connection lost), stays pending

relay.poll(); // #1 is still pending, so it is published again
// shipping: message 1 already handled, ignored
// relay: #1 marked published

relay.poll();
// relay: nothing pending
// [/client]
