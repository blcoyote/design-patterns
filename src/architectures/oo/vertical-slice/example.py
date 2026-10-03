from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional, Protocol


# --- Shared pipeline infrastructure --------------------------------------
# Everything in this section is cross-cutting infrastructure: it belongs to
# no single slice, and every slice is routed through the same instance. None
# of it — Request, Mediator, or either behaviour — names PlaceOrderCommand or
# GetOrderQuery; a slice plugs itself in by registering a handler and, if it
# needs one, a validator for its own request type.


class Request(Protocol):
    type: str


# [mediator]
class Mediator:
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[Request], object]] = {}
        self._behaviours: list["PipelineBehaviour"] = []

    def register_handler(self, request_type: str, handler: Callable[[Request], object]) -> None:
        self._handlers[request_type] = handler

    # Behaviours run in registration order, outermost first: the first behaviour
    # registered wraps everything after it, including every other behaviour.
    def use(self, behaviour: "PipelineBehaviour") -> None:
        self._behaviours.append(behaviour)

    def send(self, request: Request) -> object:
        request_type = request.type
        handler = self._handlers.get(request_type)
        if handler is None:
            raise ValueError(f"no handler registered for {request_type}")

        pipeline: Callable[[], object] = lambda: handler(request)
        for behaviour in reversed(self._behaviours):
            pipeline = lambda b=behaviour, next_fn=pipeline: b.handle(request, next_fn)
        return pipeline()
# [/mediator]


class PipelineBehaviour:
    def handle(self, request: Request, next_fn: Callable[[], object]) -> object:
        raise NotImplementedError


# [loggingBehaviour]
class LoggingBehaviour(PipelineBehaviour):
    def handle(self, request: Request, next_fn: Callable[[], object]) -> object:
        print(f"LOG: handling {request.type}")
        # If next_fn() raises (a behaviour further down the chain rejected the
        # request), this line never runs — the exception propagates straight
        # through, and "LOG: handled" never prints.
        result = next_fn()
        print(f"LOG: handled {request.type}")
        return result
# [/loggingBehaviour]


# [validationBehaviour]
class ValidationBehaviour(PipelineBehaviour):
    def __init__(self) -> None:
        # Validators are registered per request type by the slice that owns
        # that request — this class holds the registry but knows no request
        # classes.
        self._validators: dict[str, Callable[[Request], None]] = {}

    def register(self, request_type: str, validator: Callable[[Request], None]) -> None:
        self._validators[request_type] = validator

    def handle(self, request: Request, next_fn: Callable[[], object]) -> object:
        # A behaviour that does not call next_fn() short-circuits the chain: no
        # behaviour after it, and no handler, ever runs for this request. Note
        # that LoggingBehaviour runs before this one, so it has already logged
        # "handling" by the time a request gets rejected here.
        validator = self._validators.get(request.type)
        if validator is not None:
            validator(request)
        return next_fn()
# [/validationBehaviour]


# --- Shared table ---------------------------------------------------------
# Vertical slices commonly still share one physical table; what makes each
# slice "self-contained" is that it owns its own narrow data-access code on
# top of that table, not that the bytes are never shared.


@dataclass
class OrderRow:
    order_id: str
    customer_id: str
    total_cents: int


# [ordersTable]
class OrdersTable:
    def __init__(self) -> None:
        self._rows: dict[str, OrderRow] = {}

    def insert(self, row: OrderRow) -> None:
        self._rows[row.order_id] = row

    def select_by_id(self, order_id: str) -> Optional[OrderRow]:
        return self._rows.get(order_id)
# [/ordersTable]


# --- PlaceOrder slice -------------------------------------------------------
# This slice's request type, handler, data access and validator, together.
# Nothing outside this slice needs to know PlaceOrderCommand exists.


# [placeOrderStore]
class PlaceOrderStore:
    def __init__(self, table: OrdersTable) -> None:
        self._table = table

    def save(self, row: OrderRow) -> None:
        self._table.insert(row)
        print(f"PlaceOrder slice: saved order {row.order_id}")
# [/placeOrderStore]


# [placeOrderHandler]
@dataclass
class PlaceOrderCommand:
    order_id: str
    customer_id: str
    total_cents: int
    type: str = "PlaceOrder"


class PlaceOrderHandler:
    def __init__(self, store: PlaceOrderStore) -> None:
        self._store = store

    def handle(self, command: PlaceOrderCommand) -> dict:
        self._store.save(
            OrderRow(order_id=command.order_id, customer_id=command.customer_id, total_cents=command.total_cents)
        )
        return {"order_id": command.order_id}


def validate_place_order(command: PlaceOrderCommand) -> None:
    if command.total_cents <= 0:
        raise ValueError("PlaceOrder requires a positive totalCents")
# [/placeOrderHandler]


# --- GetOrder slice ---------------------------------------------------------
# A completely separate request type, handler, data access and validator — it
# shares no code with the PlaceOrder slice above except the Mediator and the
# pipeline.


# [getOrderStore]
class GetOrderStore:
    def __init__(self, table: OrdersTable) -> None:
        self._table = table

    def find_by_id(self, order_id: str) -> Optional[OrderRow]:
        return self._table.select_by_id(order_id)
# [/getOrderStore]


# [getOrderHandler]
@dataclass
class GetOrderQuery:
    order_id: str
    type: str = "GetOrder"


class GetOrderHandler:
    def __init__(self, store: GetOrderStore) -> None:
        self._store = store

    def handle(self, query: GetOrderQuery) -> OrderRow:
        row = self._store.find_by_id(query.order_id)
        if row is None:
            raise ValueError(f"no order found for {query.order_id}")
        return row


def validate_get_order(query: GetOrderQuery) -> None:
    if not query.order_id:
        raise ValueError("GetOrder requires an orderId")
# [/getOrderHandler]


# --- Usage: a command through the pipeline, a query through the same one,
# and a second, invalid command to show the pipeline rejecting it ----------

# [usage]
table = OrdersTable()

mediator = Mediator()
validation_behaviour = ValidationBehaviour()
# Each slice registers its own validator — ValidationBehaviour never learns
# PlaceOrderCommand or GetOrderQuery by name.
validation_behaviour.register("PlaceOrder", validate_place_order)
validation_behaviour.register("GetOrder", validate_get_order)

mediator.use(LoggingBehaviour())
mediator.use(validation_behaviour)

place_order_handler = PlaceOrderHandler(PlaceOrderStore(table))
get_order_handler = GetOrderHandler(GetOrderStore(table))

mediator.register_handler("PlaceOrder", lambda request: place_order_handler.handle(request))
mediator.register_handler("GetOrder", lambda request: get_order_handler.handle(request))

mediator.send(PlaceOrderCommand(order_id="order-7", customer_id="cust-11", total_cents=2500))

order = mediator.send(GetOrderQuery(order_id="order-7"))
print(f"GetOrder result: {order.order_id} {order.customer_id} ${order.total_cents / 100:.2f}")

# This PlaceOrder has total_cents=0. LoggingBehaviour still logs "handling"
# first — it runs before ValidationBehaviour in the pipeline — but
# ValidationBehaviour then raises instead of calling next_fn(), so
# PlaceOrderHandler never runs (no "saved" line) and LoggingBehaviour's
# "handled" line never prints either.
try:
    mediator.send(PlaceOrderCommand(order_id="order-8", customer_id="cust-12", total_cents=0))
except ValueError as error:
    print(f"rejected: {error}")
# [/usage]
