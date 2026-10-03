from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional


@dataclass
class PlaceOrderCommand:
    order_id: str
    customer_id: str
    total_cents: int
    type: str = "PlaceOrder"


# [aggregate]
class Order:
    def __init__(self, order_id: str, customer_id: str, total_cents: int) -> None:
        # Invariant: the write model refuses a command that would create an invalid order.
        if total_cents <= 0:
            raise ValueError(f"order {order_id}: total must be positive, got {total_cents} cents")
        self.id = order_id
        self.customer_id = customer_id
        self.total_cents = total_cents
        self.status = "placed"
# [/aggregate]


class WriteStore:
    def save(self, order: Order) -> None:
        raise NotImplementedError


# [writeStore]
class SqlWriteStore(WriteStore):
    def __init__(self) -> None:
        self._rows: dict[str, Order] = {}

    def save(self, order: Order) -> None:
        self._rows[order.id] = order
        print(f"WRITE DB: upserted order {order.id}")
# [/writeStore]


# [dispatcher]
class CommandDispatcher:
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[object], None]] = {}

    def register(self, command_type: str, handler: Callable[[object], None]) -> None:
        self._handlers[command_type] = handler

    def dispatch(self, command: object) -> None:
        handler = self._handlers.get(getattr(command, "type"))
        if handler is None:
            raise ValueError(f"no handler registered for {getattr(command, 'type')}")
        handler(command)
# [/dispatcher]


# [commandHandler]
class PlaceOrderHandler:
    def __init__(self, write_store: WriteStore, projector: "Projector") -> None:
        self._write_store = write_store
        self._projector = projector

    def handle(self, command: PlaceOrderCommand) -> None:
        order = Order(command.order_id, command.customer_id, command.total_cents)
        self._write_store.save(order)
        # In a real system the projector would pick this up off a queue, a CDC
        # stream or a cron job — asynchronously, on its own schedule. Here that
        # queue is modeled explicitly: enqueuing is instant, but nothing is
        # projected into the read store until something calls projector.catch_up().
        self._projector.enqueue(order)
# [/commandHandler]


# --- Read side ----------------------------------------------------------

@dataclass
class OrderSummaryView:
    order_id: str
    customer_id: str
    total_display: str
    status: str


class ReadStore:
    def upsert(self, view: OrderSummaryView) -> None:
        raise NotImplementedError

    def find(self, order_id: str) -> Optional[OrderSummaryView]:
        raise NotImplementedError


# [readStore]
class InMemoryReadStore(ReadStore):
    def __init__(self) -> None:
        self._views: dict[str, OrderSummaryView] = {}

    def upsert(self, view: OrderSummaryView) -> None:
        self._views[view.order_id] = view

    def find(self, order_id: str) -> Optional[OrderSummaryView]:
        return self._views.get(order_id)
# [/readStore]


# [projector]
class Projector:
    def __init__(self, read_store: ReadStore) -> None:
        self._read_store = read_store
        self._queue: list[Order] = []

    # Schedules a projection. Stands in for a message landing on a real queue.
    def enqueue(self, order: Order) -> None:
        self._queue.append(order)

    # Drains the queue, turning each pending write-model change into the
    # denormalised read shape. Calling this is the deterministic stand-in for
    # "enough time has passed for the projector to have run".
    def catch_up(self) -> None:
        for order in self._queue:
            view = OrderSummaryView(
                order_id=order.id,
                customer_id=order.customer_id,
                total_display=f"${order.total_cents / 100:.2f}",
                status=order.status,
            )
            self._read_store.upsert(view)
            print(f"READ DB: projected order {view.order_id}")
        self._queue = []
# [/projector]


# [queryHandler]
class GetOrderSummaryHandler:
    def __init__(self, read_store: ReadStore) -> None:
        self._read_store = read_store

    def handle(self, order_id: str) -> Optional[OrderSummaryView]:
        return self._read_store.find(order_id)
# [/queryHandler]


# --- Usage: command then an immediate query, to surface the lag ---------

# [usage]
write_store = SqlWriteStore()
read_store = InMemoryReadStore()
projector = Projector(read_store)
place_order_handler = PlaceOrderHandler(write_store, projector)
get_order_summary = GetOrderSummaryHandler(read_store)

dispatcher = CommandDispatcher()
dispatcher.register("PlaceOrder", lambda command: place_order_handler.handle(command))

dispatcher.dispatch(PlaceOrderCommand(order_id="order-9", customer_id="cust-42", total_cents=4998))
# [/usage]

# [eventualConsistency]
def format_view(view: Optional[OrderSummaryView]) -> str:
    if view is None:
        return "(none yet)"
    return f"{view.order_id} {view.customer_id} {view.total_display} {view.status}"


# Querying immediately after the command returns misses the projection: the
# write succeeded, but nothing has drained the projector's queue yet.
print("query right after dispatch:", format_view(get_order_summary.handle("order-9")))

projector.catch_up()

print("query after the projector has run:", format_view(get_order_summary.handle("order-9")))
# [/eventualConsistency]
