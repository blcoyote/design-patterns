from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


# [money]
@dataclass(frozen=True)
class Money:
    """Immutable value object: no identity, compared by value, every op returns a new instance.

    frozen=True makes assignment raise FrozenInstanceError and generates __eq__/__hash__ by value.
    """

    _cents: int
    currency: str = "USD"

    @staticmethod
    def of(amount: float, currency: str = "USD") -> "Money":
        # Python's round() is banker's rounding, so use half-away-from-zero to
        # match the explicit TS formula, C# MidpointRounding, and Go math.Round.
        cents = math.floor(amount * 100 + 0.5) if amount >= 0 else -math.floor(-amount * 100 + 0.5)
        return Money(cents, currency)

    def add(self, other: "Money") -> "Money":
        self._assert_same_currency(other)
        return Money(self._cents + other._cents, self.currency)

    def __str__(self) -> str:
        return f"{self._cents / 100:.2f} {self.currency}"

    def _assert_same_currency(self, other: "Money") -> None:
        if other.currency != self.currency:
            raise ValueError("currency mismatch")
# [/money]


# [orderLine]
@dataclass(frozen=True)
class OrderLine:
    """Value object: no identity of its own and never changes after creation — two lines with the same sku, price and quantity are interchangeable."""

    sku: str
    unit_price: Money
    quantity: int

    @property
    def line_total(self) -> Money:
        total = Money.of(0, self.unit_price.currency)
        for _ in range(self.quantity):
            total = total.add(self.unit_price)
        return total
# [/orderLine]


# [orderPlaced]
class DomainEvent(ABC):
    name: str

    @property
    @abstractmethod
    def occurred_at(self) -> datetime: ...


@dataclass(frozen=True)
class OrderPlaced(DomainEvent):
    """Domain event: something that happened inside the Ordering bounded context."""

    order_id: str
    customer_id: str
    total: Money
    name: str = field(default="OrderPlaced", init=False)
    _occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc), init=False)

    @property
    def occurred_at(self) -> datetime:
        return self._occurred_at
# [/orderPlaced]


class OrderPolicy(ABC):
    """Strategy: a domain policy injected into the aggregate instead of hardcoded inside it."""

    @abstractmethod
    def is_satisfied_by(self, order: "Order") -> bool: ...

    @abstractmethod
    def describe(self) -> str: ...


class RequireAtLeastOneLine(OrderPolicy):
    def is_satisfied_by(self, order: "Order") -> bool:
        return order.line_count > 0

    def describe(self) -> str:
        return "an order needs at least one line to be placed"


class OrderStatus(Enum):
    DRAFT = "draft"
    PLACED = "placed"


# [order]
class Order:
    """Aggregate root: the only object outside the aggregate is allowed to reference directly."""

    def __init__(self, order_id: str, customer_id: str) -> None:
        self.id = order_id
        self.customer_id = customer_id
        self._status = OrderStatus.DRAFT
        self._lines: list[OrderLine] = []
        self._events: list[DomainEvent] = []

    @staticmethod
    def create(order_id: str, customer_id: str) -> "Order":
        # Factory (Evans): a static creation method, so callers never build an Order directly.
        return Order(order_id, customer_id)

    @property
    def line_count(self) -> int:
        return len(self._lines)

    def add_line(self, line: OrderLine) -> None:
        # Invariant: a placed order can never be grown again — no matter who calls this,
        # or from where. The rule lives in the aggregate, not in every caller.
        if self._status is not OrderStatus.DRAFT:
            raise ValueError(f"cannot add a line to order {self.id}: already {self._status.value}")
        self._lines.append(line)

    @property
    def total(self) -> Money:
        total = Money.of(0)
        for line in self._lines:
            total = total.add(line.line_total)
        return total

    def place(self, policy: OrderPolicy) -> None:
        if self._status is not OrderStatus.DRAFT:
            raise ValueError(f"order {self.id} is already {self._status.value}")
        if not policy.is_satisfied_by(self):
            raise ValueError(f"cannot place order {self.id}: {policy.describe()}")
        self._status = OrderStatus.PLACED
        self._events.append(OrderPlaced(self.id, self.customer_id, self.total))

    def pull_events(self) -> list[DomainEvent]:
        """Events raised since the last call. The aggregate itself never publishes anything."""
        pulled, self._events = self._events, []
        return pulled
# [/order]


# [orderRepo]
class OrderRepository(ABC):
    """Repository: a collection-like abstraction for loading and saving whole aggregates."""

    @abstractmethod
    def find_by_id(self, order_id: str) -> Order | None: ...

    @abstractmethod
    def save(self, order: Order) -> None: ...


class InMemoryOrderRepository(OrderRepository):
    def __init__(self) -> None:
        self._orders: dict[str, Order] = {}

    def find_by_id(self, order_id: str) -> Order | None:
        return self._orders.get(order_id)

    def save(self, order: Order) -> None:
        self._orders[order.id] = order
# [/orderRepo]


# [shipping]
# Shipping bounded context: its own vocabulary. It has never heard of an "Order".
# Money and the domain-event interface are the only types it shares with Ordering —
# a deliberately tiny shared kernel.
@dataclass(frozen=True)
class ShipmentRequested(DomainEvent):
    shipment_id: str
    recipient_id: str
    value: Money
    name: str = field(default="ShipmentRequested", init=False)
    _occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc), init=False)

    @property
    def occurred_at(self) -> datetime:
        return self._occurred_at


class ShippingService:
    def request_shipment(self, event: ShipmentRequested) -> None:
        print(f"[shipping] shipment {event.shipment_id} requested for {event.recipient_id}, value {event.value}")
# [/shipping]


# [acl]
# Anti-Corruption Layer: conceptually owned by the downstream Shipping context. It
# translates upstream Ordering's language into Shipping's own, so Ordering's model
# never leaks into Shipping. OrderPlaced never crosses the boundary as-is — only
# ShipmentRequested does.
class OrderingToShippingAcl:
    def __init__(self, shipping: ShippingService) -> None:
        self._shipping = shipping

    def translate(self, event: OrderPlaced) -> None:
        shipment_requested = ShipmentRequested(f"ship-{event.order_id}", event.customer_id, event.total)
        self._shipping.request_shipment(shipment_requested)
# [/acl]


# [appService]
class OrderApplicationService:
    """Application service: Ordering's single entry point. No business rules of its own."""

    def __init__(self, repository: OrderRepository, acl: OrderingToShippingAcl) -> None:
        self._repository = repository
        self._acl = acl
        self._policy: OrderPolicy = RequireAtLeastOneLine()

    def start_order(self, order_id: str, customer_id: str) -> Order:
        order = Order.create(order_id, customer_id)
        self._repository.save(order)
        return order

    def place_order(self, order_id: str, lines: list[OrderLine]) -> Order:
        order = self._repository.find_by_id(order_id)
        if order is None:
            raise ValueError(f"no such order: {order_id}")

        for line in lines:
            order.add_line(line)
        order.place(self._policy)
        self._repository.save(order)

        # The application service plays observer: it collects what the aggregate raised
        # in-process, and dispatches each event onward — here, straight through the ACL.
        for event in order.pull_events():
            if isinstance(event, OrderPlaced):
                self._acl.translate(event)
        return order
# [/appService]


# Usage
if __name__ == "__main__":
    repository = InMemoryOrderRepository()
    acl = OrderingToShippingAcl(ShippingService())
    app_service = OrderApplicationService(repository, acl)

    draft = app_service.start_order("order-1", "cust-42")
    placed = app_service.place_order(
        draft.id,
        [
            OrderLine("WIDGET", Money.of(19.99), 2),
            OrderLine("GADGET", Money.of(29.99), 1),
        ],
    )
    print(f"order {placed.id} placed, total: {placed.total}")

    # Invariant in action: the aggregate refuses to grow once it has been placed.
    try:
        placed.add_line(OrderLine("LATE-ITEM", Money.of(5), 1))
    except ValueError as err:
        print(f"rejected: {err}")
