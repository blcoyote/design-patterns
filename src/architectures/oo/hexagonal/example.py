from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class LineItem:
    sku: str
    price: float


@dataclass
class PlaceOrderCommand:
    customer_id: str
    items: list[LineItem]


# [order]
# Domain entity, part of the core. It knows nothing about HTTP, SQL or any
# adapter -- only its own rules.
class Order:
    def __init__(self, customer_id: str) -> None:
        self.customer_id = customer_id
        self.lines: list[LineItem] = []

    def add_line(self, item: LineItem) -> None:
        if item.price <= 0:
            raise ValueError("line item must have a positive price")
        self.lines.append(item)

    @property
    def total(self) -> float:
        return sum(line.price for line in self.lines)
# [/order]


# [port]
# Driving port: the only way into the core. Adapters depend on this
# interface; the core never depends on them.
class PlaceOrderUseCase(ABC):
    @abstractmethod
    def execute(self, command: PlaceOrderCommand) -> Order: ...
# [/port]


# [repoPort]
# Driven port: the core declares the capability it needs, in its own
# vocabulary. It has no idea Postgres or an in-memory list will answer it.
class OrderRepository(ABC):
    @abstractmethod
    def save(self, order: Order) -> None: ...
# [/repoPort]


# [service]
# The core's application service. It implements the driving port and
# depends only on the driven port's interface -- never a concrete adapter.
class PlaceOrderService(PlaceOrderUseCase):
    def __init__(self, orders: OrderRepository) -> None:
        self._orders = orders

    def execute(self, command: PlaceOrderCommand) -> Order:
        order = Order(command.customer_id)
        for item in command.items:
            order.add_line(item)
        self._orders.save(order)
        return order
# [/service]


# [postgres]
# Driven adapter #1: talks to a real database. Swappable because it is
# just another OrderRepository as far as the core is concerned.
class PostgresOrderRepository(OrderRepository):
    def save(self, order: Order) -> None:
        database_query(
            f"INSERT INTO orders (customer_id, total) VALUES ('{order.customer_id}', {order.total})"
        )
# [/postgres]


# [inMemory]
# Driven adapter #2: an in-memory stand-in used by tests. Same port, zero
# infrastructure, and the core cannot tell the difference.
@dataclass
class InMemoryOrderRepository(OrderRepository):
    saved: list[Order] = field(default_factory=list)

    def save(self, order: Order) -> None:
        self.saved.append(order)


# A true Null Object: same port, but it discards every write instead of
# keeping one. A safe, crash-free default for local development before a
# real adapter is wired in -- unlike InMemoryOrderRepository, nothing can be
# read back out of it.
class NullOrderRepository(OrderRepository):
    def save(self, order: Order) -> None:
        pass  # intentionally does nothing
# [/inMemory]


# [controller]
# Driving adapter: translates an inbound HTTP request into the command the
# driving port understands, and calls it. It depends on the port, never on
# PlaceOrderService directly.
class HttpOrderController:
    def __init__(self, use_case: PlaceOrderUseCase) -> None:
        self._use_case = use_case

    def handle_post(self, customer_id: str, items: list[LineItem]) -> tuple[int, str]:
        order = self._use_case.execute(PlaceOrderCommand(customer_id, items))
        return 201, order.customer_id
# [/controller]


def database_query(sql: str) -> None:
    print(f"SQL: {sql}")


# Usage: production wiring plugs the real database adapter into the core.
controller = HttpOrderController(PlaceOrderService(PostgresOrderRepository()))
controller.handle_post("cust-42", [LineItem("WIDGET", 19.99), LineItem("GADGET", 29.99)])


# [test]
# Test harness: the SAME PlaceOrderService, the SAME PlaceOrderUseCase port --
# only the driven adapter changes. The core is never touched, recompiled or
# mocked; it just receives a different implementation of OrderRepository.
def test_place_order_writes_to_repository() -> None:
    repo = InMemoryOrderRepository()
    use_case: PlaceOrderUseCase = PlaceOrderService(repo)

    use_case.execute(PlaceOrderCommand("cust-1", [LineItem("WIDGET", 9.99)]))

    assert len(repo.saved) == 1, "expected exactly one saved order"
    print("test passed: order persisted through the in-memory adapter")


test_place_order_writes_to_repository()
# [/test]
