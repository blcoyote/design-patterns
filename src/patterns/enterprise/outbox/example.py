from dataclasses import dataclass
from typing import Callable


@dataclass
class OrderPlaced:
    order_id: str
    total: int


# One row of the outbox table. The id is a counter, so it is stable across retries.
@dataclass
class OutboxMessage:
    id: int
    topic: str
    payload: OrderPlaced
    published: bool = False


# [database]
# An in-memory stand-in for ONE relational database that holds both the
# business table (orders) and the outbox table.
class Transaction:
    def __init__(self) -> None:
        self.orders: list[OrderPlaced] = []
        self.messages: list[tuple[str, OrderPlaced]] = []

    def insert_order(self, order: OrderPlaced) -> None:
        self.orders.append(order)

    def insert_outbox(self, topic: str, payload: OrderPlaced) -> None:
        self.messages.append((topic, payload))


class Database:
    def __init__(self) -> None:
        self._orders: list[OrderPlaced] = []
        self._outbox: list[OutboxMessage] = []
        self._next_message_id = 1
        # Fault injection for the demo: the next mark_published() fails, as if
        # the relay lost its database connection right after publishing.
        self.fail_next_mark = False

    # [transaction]
    # Stands in for BEGIN … COMMIT: the writes are staged and applied together
    # only if work() returns, so an exception leaves both tables untouched.
    def transaction(self, work: Callable[[Transaction], None]) -> None:
        tx = Transaction()
        work(tx)
        for order in tx.orders:
            self._orders.append(order)
            print(f"db: order {order.order_id} saved")
        for topic, payload in tx.messages:
            row = OutboxMessage(self._next_message_id, topic, payload)
            self._next_message_id += 1
            self._outbox.append(row)
            print(f"db: outbox #{row.id} {row.topic} pending")
    # [/transaction]

    # [dbPending]
    # Oldest first; the comprehension builds a new list, so callers iterate a snapshot.
    def pending_messages(self) -> list[OutboxMessage]:
        return [m for m in self._outbox if not m.published]
    # [/dbPending]

    # [dbMark]
    def mark_published(self, id: int) -> None:
        if self.fail_next_mark:
            self.fail_next_mark = False
            raise RuntimeError("database connection lost")
        for row in self._outbox:
            if row.id == id:
                row.published = True
    # [/dbMark]
# [/database]


# [orderService]
class OrderService:
    def __init__(self, db: Database) -> None:
        self._db = db

    def place_order(self, order_id: str, total: int) -> None:
        # [placeOrder]
        # No broker call here. The event goes into the outbox table in the same
        # transaction as the order, so either both are saved or neither is.
        def work(tx: Transaction) -> None:
            tx.insert_order(OrderPlaced(order_id, total))
            tx.insert_outbox("order.placed", OrderPlaced(order_id, total))

        self._db.transaction(work)
        # [/placeOrder]
# [/orderService]


# [messageBroker]
Handler = Callable[[OutboxMessage], None]


class MessageBroker:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}

    def subscribe(self, topic: str, handler: Handler) -> None:
        self._handlers.setdefault(topic, []).append(handler)

    def publish(self, message: OutboxMessage) -> None:
        # [deliver]
        for handler in list(self._handlers.get(message.topic, [])):
            handler(message)
        # [/deliver]
# [/messageBroker]


# [outboxRelay]
class OutboxRelay:
    def __init__(self, db: Database, broker: MessageBroker) -> None:
        self._db = db
        self._broker = broker

    # Called on a schedule in real systems; the usage below calls it by hand.
    def poll(self) -> None:
        # [relayPoll]
        pending = self._db.pending_messages()
        # [/relayPoll]
        if not pending:
            print("relay: nothing pending")
            return
        for message in pending:
            try:
                # [relayPublish]
                self._broker.publish(message)
                # [/relayPublish]
                # [relayMark]
                # A failure between publish and mark leaves the row pending, so the
                # next poll publishes it again: delivery is at-least-once.
                self._db.mark_published(message.id)
                # [/relayMark]
                print(f"relay: #{message.id} marked published")
            except Exception as e:
                print(f"relay: #{message.id} failed ({e}), stays pending")
                break  # keep order: don't publish later messages ahead of this one
# [/outboxRelay]


# [shippingConsumer]
class ShippingConsumer:
    def __init__(self, broker: MessageBroker) -> None:
        self._handled: set[int] = set()  # only membership is checked, never iterated
        broker.subscribe("order.placed", self._on_order_placed)

    def _on_order_placed(self, message: OutboxMessage) -> None:
        # [dedupe]
        # At-least-once delivery means the same message can arrive twice, so the
        # consumer remembers the ids it has already handled.
        if message.id in self._handled:
            print(f"shipping: message {message.id} already handled, ignored")
            return
        self._handled.add(message.id)
        # [/dedupe]
        print(f"shipping: ship order {message.payload.order_id} (message {message.id})")
# [/shippingConsumer]


# [client]
db = Database()
broker = MessageBroker()
orders = OrderService(db)
relay = OutboxRelay(db, broker)
ShippingConsumer(broker)

orders.place_order("A1", 42)
# db: order A1 saved
# db: outbox #1 order.placed pending

db.fail_next_mark = True  # the relay publishes #1, then loses its connection
relay.poll()
# shipping: ship order A1 (message 1)
# relay: #1 failed (database connection lost), stays pending

relay.poll()  # #1 is still pending, so it is published again
# shipping: message 1 already handled, ignored
# relay: #1 marked published

relay.poll()
# relay: nothing pending
# [/client]
