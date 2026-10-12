from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import Callable, ClassVar, Generic, Literal, TypeVar, Union

T = TypeVar("T")
U = TypeVar("U")


# [result]
# Errors are values. A step that can fail returns a Result instead of raising, so the
# possibility of failure is visible in the type and the caller has to deal with it.
@dataclass(frozen=True)
class Ok(Generic[T]):
    value: T


@dataclass(frozen=True)
class Err:
    error: str


Result = Union[Ok[T], Err]


def ok(value: T) -> Result[T]:
    return Ok(value)


def err(error: str) -> Err:
    return Err(error)


# bind is the railway switch: on Ok it runs the next step with the value, on Err it
# skips the step and passes the same error along. Chaining binds is "railway-oriented
# programming" — the first Err short-circuits everything after it.
def bind(result: Result[T], next_step: Callable[[T], Result[U]]) -> Result[U]:
    match result:
        case Ok(value=value):
            return next_step(value)
        case Err():
            return result
# [/result]


# [money]
@dataclass(frozen=True)
class Money:
    """Value object as plain data: no behaviour, no hidden state. Equal fields mean equal money."""

    cents: int
    currency: str


def money(amount: float, currency: str = "USD") -> Money:
    # Rounds half away from zero, the same way as the OO version's Money.of. Python's
    # round() is banker's rounding, so the formula is spelled out.
    scaled = amount * 100
    cents = int(math.copysign(math.floor(abs(scaled) + 0.5), scaled))
    return Money(cents, currency)


def add_money(a: Money, b: Money) -> Money:
    # Adding two currencies is a programmer bug, not a domain outcome: no business
    # process "fails" this way, so it is raised (Wlaschin: errors you model vs. panics).
    if a.currency != b.currency:
        raise ValueError("currency mismatch")
    return Money(a.cents + b.cents, a.currency)


def format_money(m: Money) -> str:
    return f"{m.cents / 100:.2f} {m.currency}"
# [/money]


# [orderLine]
@dataclass(frozen=True)
class OrderLine:
    """Value object as plain data, meant to be created only through create_order_line.

    That is a convention: the dataclass constructor is public, so any code can still
    write OrderLine(sku, unit_price, 0) directly.
    """

    sku: str
    unit_price: Money
    quantity: int


# Smart constructor: the one place an OrderLine is meant to be built. As long as code goes
# through it, an invalid line never reaches the rest of the model. The failure comes back
# as a value, not an exception.
def create_order_line(sku: str, unit_price: Money, quantity: int) -> Result[OrderLine]:
    if quantity < 1:
        return err(f"invalid line {sku}: quantity must be at least 1")
    return ok(OrderLine(sku, unit_price, quantity))


def line_total(line: OrderLine) -> Money:
    total = money(0, line.unit_price.currency)
    for _ in range(line.quantity):
        total = add_money(total, line.unit_price)
    return total
# [/orderLine]


# [order]
# Type-state: an order is either a draft or placed, and the two are different types.
# Only a PlacedOrder has a total, so "total of a draft" cannot even be written.
# Every dataclass is frozen and the lines are a tuple: a transition builds a new value
# and leaves the old one alone.
@dataclass(frozen=True)
class DraftOrder:
    kind: ClassVar[Literal["draft"]] = "draft"
    id: str
    customer_id: str
    lines: tuple[OrderLine, ...]


@dataclass(frozen=True)
class PlacedOrder:
    kind: ClassVar[Literal["placed"]] = "placed"
    id: str
    customer_id: str
    lines: tuple[OrderLine, ...]
    total: Money


Order = Union[DraftOrder, PlacedOrder]


# Factory function: an order always starts as an empty draft.
def create_draft(id: str, customer_id: str) -> DraftOrder:
    return DraftOrder(id, customer_id, ())
# [/order]


# [orderPlaced]
# Domain event as plain data. It carries no timestamp: the imperative shell would
# stamp the time, which keeps the core pure (no clock reads).
@dataclass(frozen=True)
class OrderPlaced:
    kind: ClassVar[Literal["OrderPlaced"]] = "OrderPlaced"
    order_id: str
    customer_id: str
    total: Money


OrderEvent = Union[OrderPlaced]
# [/orderPlaced]


# [rules]
# Business rules as pure functions: each takes values and returns new values. None of
# them mutates its input or performs I/O.

# Strategy as a function type: a policy is just a function from a draft to a Result.
OrderPolicy = Callable[[DraftOrder], Result[DraftOrder]]


def require_at_least_one_line(order: DraftOrder) -> Result[DraftOrder]:
    if len(order.lines) > 0:
        return ok(order)
    return err(f"cannot place order {order.id}: an order needs at least one line to be placed")


@dataclass(frozen=True)
class PlaceOrderOutcome:
    order: PlacedOrder
    events: tuple[OrderEvent, ...]


def add_line(order: Order, line: OrderLine) -> Result[DraftOrder]:
    match order:
        case DraftOrder():
            # A new draft: the old lines are copied into a new tuple, never appended to.
            return ok(replace(order, lines=(*order.lines, line)))
        case PlacedOrder():
            # The invariant: a placed order cannot grow. It comes back as an Err value.
            return err(f"cannot add a line to order {order.id}: already placed")


def place(order: Order, policy: OrderPolicy) -> Result[PlaceOrderOutcome]:
    match order:
        case PlacedOrder():
            return err(f"order {order.id} is already placed")
        case DraftOrder():
            def accept(accepted: DraftOrder) -> Result[PlaceOrderOutcome]:
                # Fold the line totals into one Money.
                total = money(0)
                for line in accepted.lines:
                    total = add_money(total, line_total(line))
                placed = PlacedOrder(accepted.id, accepted.customer_id, accepted.lines, total)
                # The event is returned alongside the new order. Nothing is stored or published here.
                placed_event = OrderPlaced(placed.id, placed.customer_id, placed.total)
                return ok(PlaceOrderOutcome(placed, (placed_event,)))

            return bind(policy(order), accept)
# [/rules]


# [workflow]
# The input as it arrives from outside: raw, unvalidated numbers and strings.
@dataclass(frozen=True)
class UnvalidatedLine:
    sku: str
    price: float
    quantity: int


@dataclass(frozen=True)
class PlaceOrderCommand:
    order_id: str
    lines: tuple[UnvalidatedLine, ...]


# The use case as one pure function: (order, command, policy) in, Result out. It
# validates each raw line (create_order_line), adds it (add_line), then places the
# order. Each step is chained with bind, so the first Err skips every later step.
# No I/O: loading the order and storing the result are the handler's job.
def place_order_workflow(
    order: Order, cmd: PlaceOrderCommand, policy: OrderPolicy
) -> Result[PlaceOrderOutcome]:
    def add_raw_line(acc: Result[Order], raw: UnvalidatedLine) -> Result[Order]:
        return bind(
            acc,
            lambda current: bind(
                create_order_line(raw.sku, money(raw.price), raw.quantity),
                lambda line: add_line(current, line),
            ),
        )

    with_lines: Result[Order] = ok(order)
    for raw in cmd.lines:
        with_lines = add_raw_line(with_lines, raw)
    return bind(with_lines, lambda current: place(current, policy))
# [/workflow]


# [orderStore]
# Repository as a record of functions instead of an interface with a class behind it.
LoadOrder = Callable[[str], Union[Order, None]]
SaveOrder = Callable[[Order], None]


@dataclass(frozen=True)
class OrderStore:
    load: LoadOrder
    save: SaveOrder


# The in-memory adapter: the two functions close over a dict. Saving replaces whatever
# was stored under that id.
def in_memory_order_store() -> OrderStore:
    orders: dict[str, Order] = {}

    def load(id: str) -> Union[Order, None]:
        return orders.get(id)

    def save(order: Order) -> None:
        orders[order.id] = order

    return OrderStore(load, save)
# [/orderStore]


# [shipping]
# Shipping bounded context: its own vocabulary. It has never heard of an "Order" or
# of OrderPlaced.
@dataclass(frozen=True)
class ShipmentRequested:
    kind: ClassVar[Literal["ShipmentRequested"]] = "ShipmentRequested"
    shipment_id: str
    recipient_id: str
    value: Money


# A side effect, so it lives in the shell, not in the pure core.
def request_shipment(event: ShipmentRequested) -> None:
    print(
        f"[shipping] shipment {event.shipment_id} requested for {event.recipient_id}, "
        f"value {format_money(event.value)}"
    )
# [/shipping]


# [acl]
# Anti-Corruption Layer as a pure function: translates Ordering's OrderPlaced into
# Shipping's own ShipmentRequested, so Ordering's model never leaks into Shipping.
# It only builds a new value; delivering it is the handler's job.
def to_shipment_requested(event: OrderPlaced) -> ShipmentRequested:
    return ShipmentRequested(
        shipment_id=f"ship-{event.order_id}",
        recipient_id=event.customer_id,
        value=event.total,
    )
# [/acl]


# [handler]
# Dependencies are plain functions. They are handed over once, when the handler is built.
@dataclass(frozen=True)
class PlaceOrderDeps:
    load: LoadOrder
    save: SaveOrder
    publish: Callable[[ShipmentRequested], None]
    policy: OrderPolicy


# The imperative shell: I/O at the edges, the pure workflow in the middle. The
# dependencies reach it through a closure (partial application), not a constructor.
# Order: load (I/O), run the pure workflow, on Ok save (I/O), then publish each event.
def make_place_order_handler(deps: PlaceOrderDeps) -> Callable[[PlaceOrderCommand], Result[PlacedOrder]]:
    def handle(cmd: PlaceOrderCommand) -> Result[PlacedOrder]:
        existing = deps.load(cmd.order_id)
        if existing is None:
            return err(f"no such order: {cmd.order_id}")

        result = place_order_workflow(existing, cmd, deps.policy)
        match result:
            case Err():
                return result
            case Ok(value=outcome):
                deps.save(outcome.order)
                for event in outcome.events:
                    match event:
                        case OrderPlaced():
                            deps.publish(to_shipment_requested(event))
                return ok(outcome.order)

    return handle
# [/handler]


# Usage
store = in_memory_order_store()
handle_place_order = make_place_order_handler(
    PlaceOrderDeps(
        load=store.load,
        save=store.save,
        publish=request_shipment,
        policy=require_at_least_one_line,
    )
)

draft = create_draft("order-1", "cust-42")
store.save(draft)

place_result = handle_place_order(
    PlaceOrderCommand(
        order_id="order-1",
        lines=(
            UnvalidatedLine("WIDGET", 19.99, 2),
            UnvalidatedLine("GADGET", 29.99, 1),
        ),
    )
)
match place_result:
    case Ok(value=placed):
        print(f"order {placed.id} placed, total: {format_money(placed.total)}")
    case Err(error=error):
        print(f"rejected: {error}")

# Nothing was mutated: the local draft is still the empty draft it was.
print(f"original draft untouched: {draft.kind}, {len(draft.lines)} lines")

# The invariant in action: a placed order refuses to grow, and says so with an Err value.
stored = store.load("order-1")
if stored is None:
    raise RuntimeError("order-1 should be in the store")
late_result = bind(create_order_line("LATE-ITEM", money(5), 1), lambda line: add_line(stored, line))
if isinstance(late_result, Err):
    print(f"rejected: {late_result.error}")

# A smart constructor refuses an invalid line, also as a value.
broken_line = create_order_line("BROKEN", money(1), 0)
if isinstance(broken_line, Err):
    print(f"rejected: {broken_line.error}")
