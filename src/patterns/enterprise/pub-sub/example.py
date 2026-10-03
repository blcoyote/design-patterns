from dataclasses import dataclass
from typing import Any, Callable


@dataclass(frozen=True)
class OrderPlaced:
    order_id: str
    total: float


@dataclass(frozen=True)
class UserSignedUp:
    user_id: str
    email: str


Unsubscribe = Callable[[], None]


# [eventBus]
class EventBus:
    def __init__(self) -> None:
        # dict keys preserve insertion order and dedupe, standing in for JS's Set here.
        self._topics: dict[str, dict[Callable[[Any], None], None]] = {}

    # [subscribe]
    def subscribe(self, topic: str, handler: Callable[[Any], None]) -> Unsubscribe:
        handlers = self._topics.setdefault(topic, {})
        handlers[handler] = None
        return lambda: handlers.pop(handler, None)
    # [/subscribe]

    def publish(self, topic: str, payload: Any) -> None:
        # [dispatch]
        for handler in list(self._topics.get(topic, {})):
            handler(payload)
        # [/dispatch]


bus = EventBus()
# [/eventBus]


# [checkoutService]
class CheckoutService:
    def __init__(self, bus: EventBus) -> None:
        self._bus = bus

    def place_order(self, order_id: str, total: float) -> None:
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
        bus.subscribe("order.placed", lambda e: self._track("order.placed", e))
        bus.subscribe("user.signedUp", lambda e: self._track("user.signedUp", e))

    def _track(self, topic: str, payload: object) -> None:
        print(f"analytics: {topic} {payload}")
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
