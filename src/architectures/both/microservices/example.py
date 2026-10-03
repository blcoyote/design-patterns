from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class OrderLine:
    sku: str
    quantity: int


@dataclass
class Product:
    """Orders' own model of a product -- only what Orders needs, in Orders' own vocabulary."""

    sku: str
    name: str
    price: float


@dataclass
class OrderPlacedEvent:
    order_id: str
    lines: list[OrderLine]
    total: float


@dataclass
class OrderRecord:
    order_id: str
    total: float
    status: str


@dataclass
class PlaceOrderResult:
    order_id: str
    total: float
    status: str
    reason: str  # empty string when the order was paid


# [inventory]
@dataclass
class ProductDto:
    """Inventory's own wire shape. Orders never sees this directly -- only through the client below."""

    sku: str
    display_name: str
    unit_price_cents: int


class InventoryService:
    """The Inventory microservice: stands in for a separate process with its own private store."""

    def __init__(self) -> None:
        self.calls = 0
        self._products: dict[str, ProductDto] = {
            "sku-1": ProductDto("sku-1", "Widget", 1999),
            "sku-2": ProductDto("sku-2", "Gadget", 2999),
        }

    def find_product(self, sku: str) -> ProductDto:
        self.calls += 1
        dto = self._products.get(sku)
        if dto is None:
            raise ValueError(f"product {sku} not found")
        return dto
# [/inventory]


# [inventoryClient]
class InventoryServiceClient:
    """
    Orders' client proxy for Inventory: same interface shape Orders would use for a local
    call, so Orders never deals with Inventory's transport directly (Proxy). It also checks
    its own cache before calling out (Cache-Aside), and converts Inventory's ProductDto
    into Orders' own Product model (Adapter) so Inventory's wire shape never leaks in.
    """

    def __init__(self, inventory: InventoryService) -> None:
        self._inventory = inventory
        self._cache: dict[str, Product] = {}

    def get_product(self, sku: str) -> Product:
        cached = self._cache.get(sku)
        if cached is not None:
            return cached  # cache hit -- Inventory is never called

        dto = self._inventory.find_product(sku)  # cache miss -- load from the service
        product = Product(dto.sku, dto.display_name, dto.unit_price_cents / 100)
        self._cache[sku] = product  # populate the cache for next time
        return product
# [/inventoryClient]


# [breaker]
class CircuitBreaker:
    """
    A deliberately minimal circuit breaker: no timers, no clock -- just a failure counter.
    Once `failure_threshold` calls in a row have failed it opens and stays open, failing
    every further call immediately without ever invoking the wrapped function again.
    """

    def __init__(self, failure_threshold: int) -> None:
        self._failure_threshold = failure_threshold
        self._state = "CLOSED"
        self._failure_count = 0

    @property
    def is_open(self) -> bool:
        return self._state == "OPEN"

    def call(self, fn):
        if self._state == "OPEN":
            raise RuntimeError("circuit open -- failing fast")  # fn() never runs
        try:
            result = fn()
            self._failure_count = 0
            return result
        except Exception:
            self._failure_count += 1
            if self._failure_count >= self._failure_threshold:
                self._state = "OPEN"
            raise
# [/breaker]


# [payments]
class PaymentsService:
    """The Payments microservice: stands in for a separate process with its own private store."""

    def __init__(self) -> None:
        self._down = False
        self.calls = 0

    def set_down(self, down: bool) -> None:
        """Flips the processor's health. Deterministic: only ever changed by an explicit call, never a timer."""
        self._down = down

    def charge(self, order_id: str, amount: float) -> str:
        self.calls += 1
        if self._down:
            raise RuntimeError(f"payment processor unavailable for order {order_id}")
        return f"receipt-{order_id}-{amount}"
# [/payments]


# [broker]
class MessageBroker:
    """A simple in-process broker: publishers and subscribers only ever know this interface (Pub/Sub)."""

    def __init__(self) -> None:
        self._subscribers: list = []

    def subscribe(self, handler) -> None:
        self._subscribers.append(handler)

    def publish(self, event: OrderPlacedEvent) -> None:
        for handler in self._subscribers:
            handler(event)
# [/broker]


# [shipping]
class ShippingService:
    """The Shipping microservice. It only ever learns about an order by subscribing to the broker."""

    def __init__(self) -> None:
        self.received: list[OrderPlacedEvent] = []

    def on_order_placed(self, event: OrderPlacedEvent) -> None:
        self.received.append(event)
# [/shipping]


# [orders]
class OrderService:
    """The Orders microservice: stands in for a separate process, with its own private store of the orders it has recorded."""

    def __init__(
        self,
        inventory_client: InventoryServiceClient,
        payments_breaker: CircuitBreaker,
        payments: PaymentsService,
        broker: MessageBroker,
    ) -> None:
        self._inventory_client = inventory_client
        self._payments_breaker = payments_breaker
        self._payments = payments
        self._broker = broker
        self._orders: dict[str, OrderRecord] = {}
        self._next_order_id = 1  # Orders owns its own ids: counter-based, never timestamps

    @property
    def recorded_orders(self) -> list[OrderRecord]:
        return list(self._orders.values())

    def place_order(self, lines: list[OrderLine]) -> PlaceOrderResult:
        order_id = f"order-{self._next_order_id}"
        self._next_order_id += 1
        total = 0.0
        for line in lines:
            product = self._inventory_client.get_product(line.sku)
            total += product.price * line.quantity

        reason = ""
        try:
            self._payments_breaker.call(lambda: self._payments.charge(order_id, total))
            status = "PAID"
        except Exception as err:
            status = "PAYMENT_FAILED"
            reason = str(err)

        # Orders records every order it handled in its own private store, paid or not.
        self._orders[order_id] = OrderRecord(order_id, total, status)

        # Only a paid order is announced -- a failed one never reaches Shipping.
        if status == "PAID":
            self._broker.publish(OrderPlacedEvent(order_id, lines, total))

        return PlaceOrderResult(order_id, total, status, reason)
# [/orders]


# [gateway]
class ApiGateway:
    """The API Gateway: the one entry point clients see, hiding the services behind it (Facade). It only forwards -- no business logic, not even order ids."""

    def __init__(self, orders: OrderService) -> None:
        self._orders = orders

    def place_order(self, lines: list[OrderLine]) -> PlaceOrderResult:
        return self._orders.place_order(lines)
# [/gateway]


# [usage]
inventory = InventoryService()
inventory_client = InventoryServiceClient(inventory)
payments = PaymentsService()
payments_breaker = CircuitBreaker(3)  # failure_threshold
broker = MessageBroker()
shipping = ShippingService()
broker.subscribe(shipping.on_order_placed)
orders = OrderService(inventory_client, payments_breaker, payments, broker)
gateway = ApiGateway(orders)


def report(order: PlaceOrderResult) -> None:
    print(f'{order.order_id}: total=${order.total:.2f} status={order.status} reason="{order.reason}"')


# Order 1: two lines, same sku -- the second lookup is a cache hit. Payments is healthy, so it is paid.
report(gateway.place_order([OrderLine("sku-1", 1), OrderLine("sku-1", 2)]))

# The payment processor goes down -- deterministic, flipped explicitly, not by a timer.
payments.set_down(True)

# Orders 2, 3 and 4: the processor is down for all three, so the breaker counts three
# failures in a row and trips open on the third one.
report(gateway.place_order([OrderLine("sku-2", 1)]))
report(gateway.place_order([OrderLine("sku-2", 1)]))
report(gateway.place_order([OrderLine("sku-1", 1)]))
print(f"PaymentsService calls so far: {payments.calls}, breaker={'OPEN' if payments_breaker.is_open else 'CLOSED'}")

# Order 5: the breaker is now open -- it fails fast, PaymentsService.charge is never called.
report(gateway.place_order([OrderLine("sku-2", 1)]))
print(f"PaymentsService calls after breaker opened: {payments.calls}")

print(f"InventoryService product lookups: {inventory.calls}")
paid_count = len([o for o in orders.recorded_orders if o.status == "PAID"])
print(f"OrderService recorded {len(orders.recorded_orders)} orders, {paid_count} paid")
print(f"ShippingService received {len(shipping.received)} OrderPlaced events")
# [/usage]
