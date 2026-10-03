from dataclasses import dataclass


@dataclass
class LineItem:
    sku: str
    price: float


# [order]
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


class OrderRepository:
    def save(self, order: Order) -> None:
        raise NotImplementedError


# [save]
class SqlOrderRepository(OrderRepository):
    def save(self, order: Order) -> None:
        database_query(
            f"INSERT INTO orders (customer_id, total) VALUES ('{order.customer_id}', {order.total})"
        )
# [/save]


# [placeOrder]
class OrderService:
    def __init__(self, repository: OrderRepository) -> None:
        self._repository = repository

    def place_order(self, customer_id: str, items: list[LineItem]) -> Order:
        order = Order(customer_id)
        for item in items:
            order.add_line(item)
        self._repository.save(order)
        return order
# [/placeOrder]


# [controller]
class OrderController:
    def __init__(self, service: OrderService) -> None:
        self._service = service

    def handle_place_order(self, customer_id: str, items: list[LineItem]) -> tuple[int, str]:
        order = self._service.place_order(customer_id, items)
        return 201, order.customer_id

    # [violation]
    # Anti-pattern: going around the data-access layer and writing SQL here.
    # Nothing in a plain class stops this — only discipline and code review do.
    def handle_debug_lookup(self, order_id: str) -> list[object]:
        return database_query(f"SELECT * FROM orders WHERE id = '{order_id}'")
    # [/violation]
# [/controller]


def database_query(sql: str) -> list[object]:
    print(f"SQL: {sql}")
    return []


# Usage
controller = OrderController(OrderService(SqlOrderRepository()))
controller.handle_place_order("cust-42", [LineItem("WIDGET", 19.99), LineItem("GADGET", 29.99)])

# Anti-pattern in action: the controller bypasses the data-access layer and queries the database itself.
controller.handle_debug_lookup("42")
