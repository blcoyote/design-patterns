import math
from typing import Protocol


# [order]
class Order:
    def __init__(self, id: str, customer_id: str, total: float) -> None:
        self.id = id
        self.customer_id = customer_id
        self.total = total
# [/order]


# [orderRepository]
class OrderRepository(Protocol):
    def find_by_id(self, id: str) -> Order | None: ...
    def find_by_customer(self, customer_id: str) -> list[Order]: ...
    def add(self, order: Order) -> None: ...
    def save(self, order: Order) -> None: ...  # persists changes to an already-added Order
    def remove(self, id: str) -> None: ...
# [/orderRepository]


# [database]
class Database:
    def query(self, sql: str, params: list[object]) -> list[dict[str, object]]:
        print("SQL:", sql, params)
        return [{"id": "482", "customer_id": "cst-9", "total_cents": 4200}]
# [/database]


# [sqlOrderRepository]
class SqlOrderRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    # [findById]
    def find_by_id(self, id: str) -> Order | None:
        rows = self._db.query("SELECT * FROM orders WHERE id = ?", [id])
        return self._map_row(rows[0]) if rows else None
    # [/findById]

    def find_by_customer(self, customer_id: str) -> list[Order]:
        rows = self._db.query("SELECT * FROM orders WHERE customer_id = ?", [customer_id])
        return [self._map_row(row) for row in rows]

    def add(self, order: Order) -> None:
        self._db.query(
            "INSERT INTO orders (id, customer_id, total_cents) VALUES (?, ?, ?)",
            # floor(x + 0.5) matches JS Math.round; Python's round() rounds halves to even.
            [order.id, order.customer_id, math.floor(order.total * 100 + 0.5)],
        )

    def save(self, order: Order) -> None:
        # An update path for an Order already added — see the Unit of Work pattern
        # for batching several such changes into a single transaction.
        self._db.query(
            "UPDATE orders SET customer_id = ?, total_cents = ? WHERE id = ?",
            [order.customer_id, math.floor(order.total * 100 + 0.5), order.id],
        )

    def remove(self, id: str) -> None:
        self._db.query("DELETE FROM orders WHERE id = ?", [id])

    # [mapRow]
    def _map_row(self, row: dict[str, object]) -> Order:
        return Order(str(row["id"]), str(row["customer_id"]), float(row["total_cents"]) / 100)  # type: ignore[arg-type]
    # [/mapRow]
# [/sqlOrderRepository]


# [inMemoryOrderRepository]
class InMemoryOrderRepository:
    def __init__(self) -> None:
        self._orders: dict[str, Order] = {}

    def find_by_id(self, id: str) -> Order | None:
        return self._orders.get(id)

    def find_by_customer(self, customer_id: str) -> list[Order]:
        return [order for order in self._orders.values() if order.customer_id == customer_id]

    def add(self, order: Order) -> None:
        self._orders[order.id] = order

    def save(self, order: Order) -> None:
        self._orders[order.id] = order  # dict assignment already overwrites, so add and save coincide here

    def remove(self, id: str) -> None:
        self._orders.pop(id, None)
# [/inMemoryOrderRepository]


# [client]
class OrderService:
    def __init__(self, repo: OrderRepository) -> None:
        self._repo = repo

    def get_receipt(self, order_id: str) -> str:
        order = self._repo.find_by_id(order_id)
        return f"Order {order.id}: ${order.total:.2f}" if order else "not found"
# [/client]


# [usage]
# Production: wired to the real database
service = OrderService(SqlOrderRepository(Database()))
print(service.get_receipt("482"))

# Tests: the exact same service, wired to an in-memory stand-in — no database involved
fake_repo = InMemoryOrderRepository()
fake_repo.add(Order("482", "cst-9", 42))
test_service = OrderService(fake_repo)
print(test_service.get_receipt("482"))  # reads straight out of the dict, no SQL involved
# [/usage]
