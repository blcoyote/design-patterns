from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class OrderPlaced:
    order_id: str
    total: int


@dataclass(frozen=True)
class UserSignedUp:
    user_id: str
    email: str


Unsubscribe = Callable[[], None]


# One entry per subscribe() call. A plain class (not a dataclass), so equality
# is identity and list.remove() finds exactly this subscription.
class Subscription:
    def __init__(self, handler: Callable[[Any], None]) -> None:
        self.handler = handler


# [eventBus]
class EventBus:
    def __init__(self) -> None:
        # A list of subscriptions per topic, kept in subscription order.
        self._topics: dict[str, list[Subscription]] = {}

    # [subscribe]
    def subscribe(self, topic: str, handler: Callable[[Any], None]) -> Unsubscribe:
        # Each call gets its own subscription, so subscribing the same handler
        # twice delivers twice, and each unsubscribe removes only its own entry.
        subscription = Subscription(handler)
        subscriptions = self._topics.setdefault(topic, [])
        subscriptions.append(subscription)

        def unsubscribe() -> None:
            if subscription in subscriptions:
                subscriptions.remove(subscription)

        return unsubscribe
    # [/subscribe]

    def publish(self, topic: str, payload: Any) -> None:
        # [dispatch]
        # Loop over a snapshot so a handler that subscribes or unsubscribes
        # mid-publish doesn't affect the round we're already delivering.
        for subscription in list(self._topics.get(topic, [])):
            subscription.handler(payload)
        # [/dispatch]


bus = EventBus()
# [/eventBus]


# [checkoutService]
class CheckoutService:
    def __init__(self, bus: EventBus) -> None:
        self._bus = bus

    def place_order(self, order_id: str, total: int) -> None:
        # ...charge the card, persist the order...
        # [checkoutPublish]
        self._bus.publish("order.placed", OrderPlaced(order_id, total))
        # [/checkoutPublish]
# [/checkoutService]


# [userService]
class UserService:
    def __init__(self, bus: EventBus) -> None:
        self._bus = bus

    def sign_up(self, user_id: str, email: str) -> None:
        # ...create the account...
        # [userPublish]
        self._bus.publish("user.signedUp", UserSignedUp(user_id, email))
        # [/userPublish]
# [/userService]


# [emailService]
class EmailService:
    def __init__(self, bus: EventBus) -> None:
        bus.subscribe("order.placed", lambda e: self._send_receipt(e.order_id))
        bus.subscribe("user.signedUp", lambda e: self._send_welcome(e.email))

    def _send_receipt(self, order_id: str) -> None:
        print(f"email: receipt for order {order_id}")

    def _send_welcome(self, email: str) -> None:
        print(f"email: welcome {email}")
# [/emailService]


# [analyticsService]
class AnalyticsService:
    def __init__(self, bus: EventBus) -> None:
        bus.subscribe("order.placed", lambda e: self._track("order.placed", f"orderId={e.order_id} total={e.total}"))
        bus.subscribe("user.signedUp", lambda e: self._track("user.signedUp", f"userId={e.user_id} email={e.email}"))

    def _track(self, topic: str, details: str) -> None:
        print(f"analytics: {topic} {details}")
# [/analyticsService]


# [inventoryService]
class InventoryService:
    def __init__(self, bus: EventBus) -> None:
        self._stop_listening = bus.subscribe("order.placed", lambda e: self._reserve(e.order_id))

    def _reserve(self, order_id: str) -> None:
        print(f"inventory: reserved stock for {order_id}")

    # [unsubscribe]
    def stop_watching(self) -> None:
        self._stop_listening()
    # [/unsubscribe]
# [/inventoryService]


# Usage — nobody imports anybody else, only EventBus
checkout = CheckoutService(bus)
users = UserService(bus)
EmailService(bus)
AnalyticsService(bus)
inventory = InventoryService(bus)

checkout.place_order("A1", 42)  # email, analytics and inventory all react
users.sign_up("U1", "ada@example.com")  # only email and analytics react

inventory.stop_watching()
checkout.place_order("A2", 15)  # email and analytics react; inventory does not
