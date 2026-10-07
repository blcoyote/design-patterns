// A message as the broker delivers it. The id is assigned by the producer
// (for example the outbox row id), so it is the same on every redelivery.
interface OrderPlaced {
  id: number;
  orderId: string;
}

// [database]
// Thrown when an inbox id already exists, like a primary-key violation.
class DuplicateKeyError extends Error {}

// An in-memory stand-in for ONE relational database that holds both the
// business table (shipments) and the inbox table (ids already processed).
class Transaction {
  inboxIds: number[] = [];
  shipments: string[] = [];

  insertInbox(id: number) {
    this.inboxIds.push(id);
  }
  insertShipment(orderId: string) {
    this.shipments.push(orderId);
  }
}

class Database {
  private inbox = new Set<number>();
  readonly shipments: string[] = [];
  // Fault injection for the demo: the next transaction fails before it
  // commits, as if the connection dropped mid-handler.
  failNextCommit = false;

  // [dbSeen]
  // A cheap pre-check. It is not the guard: two concurrent deliveries can both
  // pass it, so transaction() enforces the unique inbox id at commit.
  alreadyProcessed(id: number): boolean {
    return this.inbox.has(id);
  }
  // [/dbSeen]

  // [transaction]
  // Stands in for BEGIN … COMMIT: the writes are staged and applied together
  // only if work() returns and the commit succeeds, so a failure leaves both
  // tables untouched. An inbox id that already exists violates the primary key
  // and rolls the whole transaction back, shipment included.
  transaction(work: (tx: Transaction) => void): void {
    const tx = new Transaction();
    work(tx);
    if (this.failNextCommit) {
      this.failNextCommit = false;
      throw new Error("database connection lost");
    }
    if (tx.inboxIds.some((id) => this.inbox.has(id)))
      throw new DuplicateKeyError("duplicate inbox id");
    for (const id of tx.inboxIds) this.inbox.add(id);
    for (const orderId of tx.shipments) this.shipments.push(orderId);
    console.log(`db: inbox #${tx.inboxIds[0]} + shipment ${tx.shipments[0]} saved`);
  }
  // [/transaction]
}
// [/database]

// [messageBroker]
type Handler = (message: OrderPlaced) => void;

class MessageBroker {
  private handlers: Handler[] = [];
  // Fault injection for the demo: the next acknowledgement never arrives.
  dropNextAck = false;

  subscribe(handler: Handler): void {
    this.handlers.push(handler);
  }

  publish(message: OrderPlaced): void {
    // [deliver]
    // At-least-once: keep delivering until a handler returns and its
    // acknowledgement arrives. A failure or a lost ack both mean "try again".
    while (true) {
      try {
        for (const handler of [...this.handlers]) handler(message);
      } catch (e) {
        console.log(
          `broker: message ${message.id} failed (${e instanceof Error ? e.message : String(e)}), redelivering`,
        );
        continue;
      }
      if (this.dropNextAck) {
        this.dropNextAck = false;
        console.log(`broker: ack for message ${message.id} lost, redelivering`);
        continue;
      }
      console.log(`broker: message ${message.id} acked`);
      return;
    }
    // [/deliver]
  }
}
// [/messageBroker]

// [shippingConsumer]
class ShippingConsumer {
  constructor(
    private db: Database,
    broker: MessageBroker,
  ) {
    broker.subscribe((message) => this.onOrderPlaced(message));
  }

  private onOrderPlaced(message: OrderPlaced): void {
    console.log(`shipping: received message ${message.id}`);
    // [inboxCheck]
    // Seen this id before? Then the work was already done: do nothing and
    // return normally, so the broker gets its ack and stops redelivering.
    if (this.db.alreadyProcessed(message.id)) {
      console.log(`shipping: message ${message.id} already in inbox, ignored`);
      return;
    }
    // [/inboxCheck]
    // [inboxCommit]
    // The inbox row and the shipment are written in ONE transaction. A crash
    // can never leave "shipped but not recorded" or "recorded but not shipped".
    try {
      this.db.transaction((tx) => {
        tx.insertInbox(message.id);
        tx.insertShipment(message.orderId);
      });
    } catch (e) {
      // Lost a race with a concurrent delivery of the same message: its
      // transaction won, ours rolled back, so this one is just a duplicate.
      if (!(e instanceof DuplicateKeyError)) throw e;
      console.log(`shipping: message ${message.id} already in inbox, ignored`);
    }
    // [/inboxCommit]
  }
}
// [/shippingConsumer]

// [client]
const db = new Database();
const broker = new MessageBroker();
new ShippingConsumer(db, broker);

db.failNextCommit = true; // attempt 1 dies inside the transaction
broker.dropNextAck = true; // attempt 2 succeeds, but its ack is lost
broker.publish({ id: 1, orderId: "A1" });
// shipping: received message 1
// broker: message 1 failed (database connection lost), redelivering
// shipping: received message 1
// db: inbox #1 + shipment A1 saved
// broker: ack for message 1 lost, redelivering
// shipping: received message 1
// shipping: message 1 already in inbox, ignored
// broker: message 1 acked

console.log(`shipments: ${db.shipments.length}`);
// shipments: 1
// [/client]
