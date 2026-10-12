from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal, Protocol, TypeVar


# [contracts]
# The public contracts the modules share (a "published language"). Nothing internal lives
# here: no module's records, stores or implementation classes, only what crosses a boundary.


@dataclass(frozen=True)
class ProductInfo:
    """What Catalog's API returns. Deliberately NOT Catalog's internal record."""

    sku: str
    name: str
    price_cents: int


class CatalogApi(Protocol):
    def get_product(self, sku: str) -> ProductInfo | None: ...

    def set_price(self, sku: str, price_cents: int) -> None: ...


@dataclass(frozen=True)
class OrderLineRequest:
    sku: str
    quantity: int


@dataclass(frozen=True)
class PlaceOrderResult:
    """A rejection is a normal result, not an exception: order_id is "" and reason is set."""

    accepted: bool
    order_id: str  # empty string when the order was rejected
    total_cents: int
    reason: str  # empty string when the order was accepted


class OrderingApi(Protocol):
    def place_order(self, customer_id: str, lines: list[OrderLineRequest]) -> PlaceOrderResult: ...

    def order_total(self, order_id: str) -> int | None: ...


@dataclass(frozen=True)
class OrderPlaced:
    """The integration event Ordering publishes. Shipping depends on this shape, not on Ordering."""

    order_id: str
    customer_id: str
    total_cents: int


class ShippingApi(Protocol):
    def status_for(self, order_id: str) -> str:
        """"ready to ship" or "unknown"."""
        ...


# Every module's name. Each name has exactly one public API: catalog -> CatalogApi,
# ordering -> OrderingApi, shipping -> ShippingApi.
ModuleName = Literal["catalog", "ordering", "shipping"]


def format_cents(cents: int) -> str:
    """Money is integer cents everywhere. Formats 6997 as "69.97" with integer arithmetic only (no floats)."""
    whole = cents // 100
    fraction = cents % 100
    return f"{whole}.{fraction:02d}"
# [/contracts]


# [eventBus]
OrderPlacedHandler = Callable[[OrderPlaced], None]


class InProcessEventBus:
    """
    An in-process event bus for OrderPlaced. Publish calls every handler synchronously, in
    subscription order, on the caller's own call stack: same process, so no network. A real
    modular monolith often pairs this with an outbox, so the event commits together with the
    publishing module's own data. This bus has no outbox and does not persist anything.
    """

    def __init__(self) -> None:
        self._handlers: list[OrderPlacedHandler] = []

    def subscribe(self, handler: OrderPlacedHandler) -> None:
        self._handlers.append(handler)

    def publish(self, event: OrderPlaced) -> None:
        # Iterate a snapshot: a handler subscribed during publish first runs on the next publish.
        for handler in list(self._handlers):
            handler(event)
# [/eventBus]


# [host]
T = TypeVar("T")


@dataclass(frozen=True)
class ModuleContext:
    """What a module's factory receives: the shared bus and a way to reach the modules it declared."""

    bus: InProcessEventBus
    # The host looks modules up in a plain dict, so the result is typed Any: the caller
    # knows which API it asked for (use("catalog") is a CatalogApi).
    use: Callable[[ModuleName], Any]


class ModuleHost:
    """
    The composition root of the single deployable. It starts each module, hands it a
    ModuleContext, and refuses any lookup of a module the requester did not declare.
    """

    def __init__(self, bus: InProcessEventBus) -> None:
        self._bus = bus
        self.started: list[ModuleName] = []  # names of the started modules, in registration order
        self._apis: dict[ModuleName, Any] = {}
        self._dependencies: dict[ModuleName, list[ModuleName]] = {}

    def register(
        self,
        name: ModuleName,
        depends_on: list[ModuleName],
        factory: Callable[[ModuleContext], T],
    ) -> T:
        """Registering is starting: the factory runs immediately and only its returned API is kept."""
        self._dependencies[name] = depends_on
        ctx = ModuleContext(self._bus, lambda target: self.use(name, target))
        api = factory(ctx)
        self._apis[name] = api
        self.started.append(name)
        return api

    def use(self, requester: ModuleName, target: ModuleName) -> Any:
        """
        The boundary check: a module may only reach modules it declared. In a real codebase an
        architecture test enforces the same rule (ArchUnit/NetArchTest, import-linter, Go's internal/ packages).
        """
        if target not in self._dependencies.get(requester, []):
            raise RuntimeError(f"{requester} does not declare a dependency on {target}")
        api = self._apis.get(target)
        if api is None:
            raise RuntimeError(f"{target} is not started")
        return api
# [/host]


# [catalog]
@dataclass
class _CatalogRecord:
    """Catalog's internal record. It never leaves the module: supplier_code is internal only."""

    sku: str
    name: str
    price_cents: int
    supplier_code: str


class _CatalogModule:
    """
    The Catalog module. In Python the hiding mechanism is convention: the factory returns an
    instance of this underscore-prefixed class, and the leading underscores mark the class and
    its store as private. The language does not stop another module from reaching into them;
    in a real codebase import-linter enforces the boundary. Other languages hide it
    differently (closures, private classes, unexported types).
    """

    def __init__(self, ctx: ModuleContext) -> None:
        self._records: dict[str, _CatalogRecord] = {
            "sku-1": _CatalogRecord("sku-1", "Widget", 1999, "SUP-W"),
            "sku-2": _CatalogRecord("sku-2", "Gadget", 2999, "SUP-G"),
        }

    def get_product(self, sku: str) -> ProductInfo | None:
        record = self._records.get(sku)
        if record is None:
            return None
        # Map the internal record to the public ProductInfo; supplier_code stays inside.
        return ProductInfo(record.sku, record.name, record.price_cents)

    def set_price(self, sku: str, price_cents: int) -> None:
        record = self._records.get(sku)
        if record is None:
            return
        record.price_cents = price_cents
        print(f"[catalog] {sku} repriced to {format_cents(price_cents)}")


def create_catalog_module(ctx: ModuleContext) -> CatalogApi:
    return _CatalogModule(ctx)
# [/catalog]


# [ordering]
@dataclass(frozen=True)
class _StoredOrderLine:
    """One stored order line. unit_price_cents is Ordering's own copy, taken at placement time."""

    sku: str
    quantity: int
    unit_price_cents: int


@dataclass(frozen=True)
class _StoredOrder:
    order_id: str
    customer_id: str
    lines: list[_StoredOrderLine]


class _OrderingModule:
    """
    The Ordering module. It asks the host for Catalog once, at creation: that call succeeds
    only because "catalog" is in Ordering's declared dependencies. Its orders live in a
    private attribute (by convention), so other modules reach them only through OrderingApi.
    """

    def __init__(self, ctx: ModuleContext) -> None:
        self._ctx = ctx
        self._catalog: CatalogApi = ctx.use("catalog")
        self._orders: dict[str, _StoredOrder] = {}
        self._next_order_number = 1  # counter-based ids, never timestamps

    def place_order(self, customer_id: str, lines: list[OrderLineRequest]) -> PlaceOrderResult:
        stored_lines: list[_StoredOrderLine] = []
        for line in lines:
            product = self._catalog.get_product(line.sku)
            if product is None:
                # Reject before assigning an id: nothing is stored and nothing is published.
                return PlaceOrderResult(False, "", 0, f"unknown product {line.sku}")
            stored_lines.append(_StoredOrderLine(line.sku, line.quantity, product.price_cents))

        total_cents = 0
        for stored in stored_lines:
            total_cents += stored.unit_price_cents * stored.quantity

        order_id = f"order-{self._next_order_number}"
        self._next_order_number += 1
        self._orders[order_id] = _StoredOrder(order_id, customer_id, stored_lines)  # save the copied prices
        self._ctx.bus.publish(OrderPlaced(order_id, customer_id, total_cents))
        return PlaceOrderResult(True, order_id, total_cents, "")

    def order_total(self, order_id: str) -> int | None:
        order = self._orders.get(order_id)
        if order is None:
            return None
        # Computed from Ordering's own stored copy: Catalog is never called here.
        total_cents = 0
        for line in order.lines:
            total_cents += line.unit_price_cents * line.quantity
        return total_cents


def create_ordering_module(ctx: ModuleContext) -> OrderingApi:
    return _OrderingModule(ctx)
# [/ordering]


# [shipping]
@dataclass(frozen=True)
class _Shipment:
    shipment_id: str
    status: str


class _ShippingModule:
    """
    The Shipping module. It declares no module dependencies: it knows only the OrderPlaced
    contract and learns about orders by subscribing to the bus.
    """

    def __init__(self, ctx: ModuleContext) -> None:
        self._shipments: dict[str, _Shipment] = {}  # keyed by order_id
        self._next_shipment_number = 1  # its own counter, independent of Ordering's
        ctx.bus.subscribe(self._on_order_placed)

    def _on_order_placed(self, event: OrderPlaced) -> None:
        shipment_id = f"ship-{self._next_shipment_number}"
        self._next_shipment_number += 1
        self._shipments[event.order_id] = _Shipment(shipment_id, "ready to ship")
        print(f"[shipping] shipment {shipment_id} created for {event.order_id}")

    def status_for(self, order_id: str) -> str:
        shipment = self._shipments.get(order_id)
        return shipment.status if shipment is not None else "unknown"


def create_shipping_module(ctx: ModuleContext) -> ShippingApi:
    return _ShippingModule(ctx)
# [/shipping]


# [usage]
bus = InProcessEventBus()
host = ModuleHost(bus)
# Registration order is start order; ordering needs catalog, so catalog is registered first.
catalog = host.register("catalog", [], create_catalog_module)
ordering = host.register("ordering", ["catalog"], create_ordering_module)
shipping = host.register("shipping", [], create_shipping_module)
print(f"modules started: {', '.join(host.started)}")

# A client outside the monolith talks to the public APIs only.
placed = ordering.place_order(
    "cust-42",
    [OrderLineRequest("sku-1", 2), OrderLineRequest("sku-2", 1)],
)
print(f"{placed.order_id} placed for cust-42, total {format_cents(placed.total_cents)}")

# Unknown product: a rejected result, not an exception. No id is assigned.
rejected = ordering.place_order("cust-42", [OrderLineRequest("sku-9", 1)])
print(f"rejected: {rejected.reason}")

# Catalog changes its own price; Ordering kept its own copy of the old one.
catalog.set_price("sku-1", 2499)
total = ordering.order_total("order-1")
print("order-1 total unknown" if total is None else f"order-1 total still {format_cents(total)}")

print(f"shipping status for order-1: {shipping.status_for('order-1')}")

# Shipping never declared catalog, so the host refuses the lookup.
try:
    host.use("shipping", "catalog")
except RuntimeError as err:
    print(f"rejected: {err}")
# [/usage]
