from dataclasses import dataclass
from typing import Callable


# A message as the broker delivers it. The id is assigned by the producer
# (for example the outbox row id), so it is the same on every redelivery.
@dataclass
class OrderPlaced:
    id: int
    order_id: str


# [database]
# Raised when an inbox id already exists, like a primary-key violation.
class DuplicateKeyError(Exception):
    pass


# An in-memory stand-in for ONE relational database that holds both the
# business table (shipments) and the inbox table (ids already processed).
class Transaction:
    def __init__(self) -> None:
        self.inbox_ids: list[int] = []
        self.shipments: list[str] = []

    def insert_inbox(self, id: int) -> None:
        self.inbox_ids.append(id)

    def insert_shipment(self, order_id: str) -> None:
        self.shipments.append(order_id)


class Database:
    def __init__(self) -> None:
        self._inbox: set[int] = set()
        self.shipments: list[str] = []
        # Fault injection for the demo: the next transaction fails before it
        # commits, as if the connection dropped mid-handler.
        self.fail_next_commit = False

    # [dbSeen]
    # A cheap pre-check. It is not the guard: two concurrent deliveries can both
    # pass it, so transaction() enforces the unique inbox id at commit.
    def already_processed(self, id: int) -> bool:
        return id in self._inbox
    # [/dbSeen]

    # [transaction]
    # Stands in for BEGIN … COMMIT: the writes are staged and applied together
    # only if work() returns and the commit succeeds, so a failure leaves both
    # tables untouched. An inbox id that already exists violates the primary key
    # and rolls the whole transaction back, shipment included.
    def transaction(self, work: Callable[[Transaction], None]) -> None:
        tx = Transaction()
        work(tx)
        if self.fail_next_commit:
            self.fail_next_commit = False
            raise RuntimeError("database connection lost")
        if any(id in self._inbox for id in tx.inbox_ids):
            raise DuplicateKeyError("duplicate inbox id")
        self._inbox.update(tx.inbox_ids)
        self.shipments.extend(tx.shipments)
        print(f"db: inbox #{tx.inbox_ids[0]} + shipment {tx.shipments[0]} saved")
    # [/transaction]
# [/database]


# [messageBroker]
Handler = Callable[[OrderPlaced], None]


class MessageBroker:
    def __init__(self) -> None:
        self._handlers: list[Handler] = []
        # Fault injection for the demo: the next acknowledgement never arrives.
        self.drop_next_ack = False

    def subscribe(self, handler: Handler) -> None:
        self._handlers.append(handler)

    def publish(self, message: OrderPlaced) -> None:
        # [deliver]
        # At-least-once: keep delivering until a handler returns and its
        # acknowledgement arrives. A failure or a lost ack both mean "try again".
        while True:
            try:
                for handler in list(self._handlers):
                    handler(message)
            except Exception as e:
                print(f"broker: message {message.id} failed ({e}), redelivering")
                continue
            if self.drop_next_ack:
                self.drop_next_ack = False
                print(f"broker: ack for message {message.id} lost, redelivering")
                continue
            print(f"broker: message {message.id} acked")
            return
        # [/deliver]
# [/messageBroker]


# [shippingConsumer]
class ShippingConsumer:
    def __init__(self, db: Database, broker: MessageBroker) -> None:
        self._db = db
        broker.subscribe(self._on_order_placed)

    def _on_order_placed(self, message: OrderPlaced) -> None:
        print(f"shipping: received message {message.id}")
        # [inboxCheck]
        # Seen this id before? Then the work was already done: do nothing and
        # return normally, so the broker gets its ack and stops redelivering.
        if self._db.already_processed(message.id):
            print(f"shipping: message {message.id} already in inbox, ignored")
            return
        # [/inboxCheck]
        # [inboxCommit]
        # The inbox row and the shipment are written in ONE transaction. A crash
        # can never leave "shipped but not recorded" or "recorded but not shipped".
        def work(tx: Transaction) -> None:
            tx.insert_inbox(message.id)
            tx.insert_shipment(message.order_id)

        try:
            self._db.transaction(work)
        except DuplicateKeyError:
            # Lost a race with a concurrent delivery of the same message: its
            # transaction won, ours rolled back, so this one is just a duplicate.
            print(f"shipping: message {message.id} already in inbox, ignored")
        # [/inboxCommit]
# [/shippingConsumer]


# [client]
db = Database()
broker = MessageBroker()
ShippingConsumer(db, broker)

db.fail_next_commit = True  # attempt 1 dies inside the transaction
broker.drop_next_ack = True  # attempt 2 succeeds, but its ack is lost
broker.publish(OrderPlaced(1, "A1"))
# shipping: received message 1
# broker: message 1 failed (database connection lost), redelivering
# shipping: received message 1
# db: inbox #1 + shipment A1 saved
# broker: ack for message 1 lost, redelivering
# shipping: received message 1
# shipping: message 1 already in inbox, ignored
# broker: message 1 acked

print(f"shipments: {len(db.shipments)}")
# shipments: 1
# [/client]
