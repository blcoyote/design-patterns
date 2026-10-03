from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Callable


# [events]
@dataclass(frozen=True)
class OrderPlaced:
    order_id: int
    item: str
    quantity: int


@dataclass(frozen=True)
class StockReserved:
    order_id: int
    item: str
# [/events]


# [broker]
@dataclass
class QueuedMessage:
    topic: str
    event: object


class EventBroker:
    """
    Broker: keeps a list of handlers per topic and an explicit, drainable queue.
    Publishing only enqueues a message — it never calls a handler directly, and
    draining is FIFO, so delivery order is deterministic and identical across languages.
    """

    def __init__(self) -> None:
        # A plain dict, not a set: Python sets are unordered, and subscriber order
        # (and topic registration order) must stay deterministic and match TS/C#.
        self.subscribers: dict[str, list[Callable[[object], None]]] = {}
        self.queue: deque[QueuedMessage] = deque()

    def subscribe(self, topic: str, handler: Callable[[object], None]) -> None:
        self.subscribers.setdefault(topic, []).append(handler)

    def publish(self, topic: str, event: object) -> None:
        # The publisher only knows a topic name, never a handler — adding or removing
        # a subscriber never requires touching this method or its caller.
        self.queue.append(QueuedMessage(topic, event))

    def drain(self) -> None:
        """Drains the queue FIFO, including messages a handler enqueues while draining (choreography)."""
        while self.queue:
            message = self.queue.popleft()
            for handler in self.subscribers.get(message.topic, []):
                handler(message.event)
# [/broker]


# [dedupe]
def dedupe(handler: Callable[[object], None]) -> Callable[[object], None]:
    """
    Consumer-side handler pipeline (a tiny Chain of Responsibility): wraps a handler so a
    redelivered message with an order_id already seen is dropped before it reaches the
    real handler. This lives on the consumer, not the broker — the broker has no idea
    deduplication is happening.
    """
    seen: dict[int, bool] = {}

    def wrapped(event: object) -> None:
        order_placed = event  # type: OrderPlaced
        if order_placed.order_id in seen:
            print(f"[inventory] duplicate OrderPlaced({order_placed.order_id}) ignored")
            return
        seen[order_placed.order_id] = True
        handler(event)

    return wrapped
# [/dedupe]


# [email]
class EmailConsumer:
    def on_order_placed(self, event: OrderPlaced) -> None:
        print(f"[email] confirmation sent for order {event.order_id} ({event.quantity} x {event.item})")
# [/email]


# [inventory]
class InventoryConsumer:
    def __init__(self, broker: EventBroker) -> None:
        self.broker = broker

    def on_order_placed(self, event: OrderPlaced) -> None:
        print(f"[inventory] reserved {event.quantity} x {event.item} for order {event.order_id}")
        # Choreography: Inventory decides on its own to publish the next event — nothing
        # orchestrates this, and the broker itself has no idea what topic comes next.
        stock_reserved = StockReserved(event.order_id, event.item)
        self.broker.publish("StockReserved", stock_reserved)
# [/inventory]


# [analytics]
class AnalyticsConsumer:
    def __init__(self) -> None:
        self.count = 0

    def on_order_placed(self, _event: OrderPlaced) -> None:
        self.count += 1
        print(f"[analytics] order count: {self.count}")
# [/analytics]


# [loyalty]
# Added after the system is already running, subscribing to the exact same topic.
# OrdersProducer below is never touched to make this consumer exist.
class LoyaltyConsumer:
    def on_order_placed(self, event: OrderPlaced) -> None:
        print(f"[loyalty] points awarded for order {event.order_id}")
# [/loyalty]


# [producer]
class OrdersProducer:
    def __init__(self, broker: EventBroker) -> None:
        self.broker = broker
        self.next_order_id = 1

    def place_order(self, item: str, quantity: int) -> int:
        order_id = self.next_order_id
        self.next_order_id += 1
        event = OrderPlaced(order_id, item, quantity)
        # The producer depends on the broker and a topic name only — not on a single
        # consumer, and not on how many consumers (zero or a dozen) are listening.
        self.broker.publish("OrderPlaced", event)
        return order_id

    def redeliver(self, order_id: int, item: str, quantity: int) -> None:
        """Simulates an at-least-once broker redelivering a message it already delivered once."""
        event = OrderPlaced(order_id, item, quantity)
        self.broker.publish("OrderPlaced", event)
# [/producer]


# Usage
# [usage]
broker = EventBroker()
email = EmailConsumer()
inventory = InventoryConsumer(broker)
analytics = AnalyticsConsumer()

broker.subscribe("OrderPlaced", email.on_order_placed)
broker.subscribe("OrderPlaced", dedupe(inventory.on_order_placed))
broker.subscribe("OrderPlaced", analytics.on_order_placed)

producer = OrdersProducer(broker)

order_id = producer.place_order("WIDGET", 2)
broker.drain()

# At-least-once redelivery: Inventory's dedupe pipeline recognizes order 1 and drops
# it; Email and Analytics have no such pipeline, so they process it again.
producer.redeliver(order_id, "WIDGET", 2)
broker.drain()

# Adding a consumer requires no change to OrdersProducer, EventBroker, or any other
# consumer — only a new subscribe() call.
loyalty = LoyaltyConsumer()
broker.subscribe("OrderPlaced", loyalty.on_order_placed)

producer.place_order("GADGET", 1)
broker.drain()
# [/usage]
