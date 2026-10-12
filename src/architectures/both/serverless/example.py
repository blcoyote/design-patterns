from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from typing import Literal, Protocol, Union


# [events]
# What a function is given and what it may return. A function never sees the platform: it
# receives one trigger event plus the managed services, and that is all. The events form a
# union discriminated by kind, one member per way a function can be triggered.


@dataclass(frozen=True)
class OrderRequest:
    """The body of a request to place an order. Money is integer cents everywhere."""

    customer_id: str
    total_cents: int


@dataclass(frozen=True)
class OrderPlaced:
    """The message that tells the rest of the system an order was placed."""

    order_id: str


@dataclass(frozen=True)
class HttpEvent:
    """A request from outside."""

    method: str
    path: str
    body: OrderRequest
    kind: Literal["http"] = "http"


@dataclass(frozen=True)
class QueueEvent:
    """A message the platform took from a queue and hands to the function subscribed to it."""

    queue: str
    message: OrderPlaced
    kind: Literal["queue"] = "queue"


@dataclass(frozen=True)
class ScheduleEvent:
    """A schedule firing. It carries no data: the function reads whatever it needs from the services."""

    schedule: str
    kind: Literal["schedule"] = "schedule"


TriggerEvent = Union[HttpEvent, QueueEvent, ScheduleEvent]


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: str


class FunctionInstance(Protocol):
    """
    The function contract. Only an http function has a caller waiting for an answer, so the
    others return None. One instance is created per cold start and handles invocations one
    after another.
    """

    def handle(self, event: TriggerEvent, services: Services) -> HttpResponse | None: ...


@dataclass(frozen=True)
class HttpTrigger:
    route: str
    kind: Literal["http"] = "http"


@dataclass(frozen=True)
class QueueTrigger:
    queue: str
    kind: Literal["queue"] = "queue"


@dataclass(frozen=True)
class ScheduleTrigger:
    schedule: str
    kind: Literal["schedule"] = "schedule"


# What makes the platform run a function.
Trigger = Union[HttpTrigger, QueueTrigger, ScheduleTrigger]


@dataclass(frozen=True)
class FunctionDefinition:
    """A deployed function: its name, what triggers it, and how to build a fresh instance of it."""

    name: str
    trigger: Trigger
    create: Callable[[], FunctionInstance]


def format_cents(cents: int) -> str:
    """Formats 6997 as "69.97" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator)."""
    absolute = abs(cents)
    whole = absolute // 100
    fraction = absolute % 100
    sign = "-" if cents < 0 else ""
    return f"{sign}{whole}.{fraction:02d}"
# [/events]


# [services]
@dataclass(frozen=True)
class Order:
    """One row in the orders table."""

    id: str
    customer_id: str
    total_cents: int
    status: Literal["received", "receipted"]


class OrderStore:
    """
    A managed table that outlives every function instance. Real systems use a hosted database
    (DynamoDB, Cosmos DB, Firestore); here it is a dict in memory. The id counter lives in the
    store too, so ids stay unique no matter how many instances come and go.
    """

    def __init__(self) -> None:
        # A dict iterates in insertion order, and saving an existing id keeps its place.
        self._rows: dict[str, Order] = {}
        self._last_id = 0

    def next_order_id(self) -> str:
        self._last_id += 1
        return f"order-{self._last_id}"

    def save(self, order: Order) -> None:
        """Inserts the order, or replaces the row with the same id."""
        self._rows[order.id] = order

    def get(self, id: str) -> Order | None:
        return self._rows.get(id)

    def all(self) -> list[Order]:
        """Every order, oldest first."""
        return list(self._rows.values())


class MessageQueues:
    """
    Managed named queues, standing in for SQS, Service Bus or Pub/Sub. These are first in first out; real
    services guarantee order only when configured for it (SQS FIFO queues, Service Bus sessions, Pub/Sub ordering keys). A message
    waits here until the platform takes it and hands it to the subscribed function.
    """

    def __init__(self) -> None:
        self._queues: dict[str, deque[OrderPlaced]] = {}

    def enqueue(self, queue: str, message: OrderPlaced) -> None:
        waiting = self._queues.get(queue)
        if waiting is None:
            self._queues[queue] = deque([message])
        else:
            waiting.append(message)

    def take(self, queue: str) -> OrderPlaced | None:
        """Removes and returns the oldest message, or None when the queue is empty."""
        waiting = self._queues.get(queue)
        if not waiting:
            return None
        return waiting.popleft()


@dataclass(frozen=True)
class Services:
    """Handed to every invocation. Functions keep nothing that must last anywhere else."""

    orders: OrderStore
    queues: MessageQueues
# [/services]


# [platform]
@dataclass
class _DeployedFunction:
    definition: FunctionDefinition
    # At most one warm instance per function.
    warm: FunctionInstance | None = None
    cold_starts: int = 0


class Platform:
    """
    The managed runtime. It decides when functions are created, reused, triggered and
    discarded. AWS Lambda, Azure Functions and Google Cloud Functions make all of these
    decisions themselves and run many instances of one function side by side; this class only
    makes it visible. It keeps at most one warm instance per function because the invocations
    here run one after another, and there are no timers or clock: reclaim_idle stands for idle
    time passing and tick stands for a schedule firing.
    """

    def __init__(self, services: Services) -> None:
        self._services = services
        # Functions in registration order: that order is the order queues are drained in.
        self._functions: list[_DeployedFunction] = []

    def register(self, definition: FunctionDefinition) -> None:
        self._functions.append(_DeployedFunction(definition))

    def http(self, method: str, path: str, body: OrderRequest) -> HttpResponse:
        """Routes a request to the function whose http trigger has the route "<method> <path>"."""
        route = f"{method} {path}"
        target = next(
            (
                candidate
                for candidate in self._functions
                if isinstance(candidate.definition.trigger, HttpTrigger) and candidate.definition.trigger.route == route
            ),
            None,
        )
        # A request nobody listens for is a programmer bug, not something to answer with a 404.
        if target is None:
            raise LookupError(f"no function for {route}")
        response = self._invoke(target.definition, HttpEvent(method=method, path=path, body=body))
        if response is None:
            raise RuntimeError(f"{target.definition.name} returned no response")
        return response

    def drain_queues(self) -> None:
        """
        For each queue-triggered function in registration order, keeps taking the next message
        from its queue and invoking the function until that queue is empty.
        """
        for deployed in self._functions:
            trigger = deployed.definition.trigger
            if not isinstance(trigger, QueueTrigger):
                continue
            message = self._services.queues.take(trigger.queue)
            while message is not None:
                self._invoke(deployed.definition, QueueEvent(queue=trigger.queue, message=message))
                message = self._services.queues.take(trigger.queue)

    def tick(self, schedule: str) -> None:
        """A schedule fires: invokes the function subscribed to it."""
        target = next(
            (
                candidate
                for candidate in self._functions
                if isinstance(candidate.definition.trigger, ScheduleTrigger)
                and candidate.definition.trigger.schedule == schedule
            ),
            None,
        )
        if target is None:
            raise LookupError(f"no function for schedule {schedule}")
        self._invoke(target.definition, ScheduleEvent(schedule=schedule))

    def reclaim_idle(self) -> None:
        """Scale to zero: drops every warm instance, and with it everything that was only in memory."""
        reclaimed = 0
        for deployed in self._functions:
            if deployed.warm is not None:
                reclaimed += 1
            deployed.warm = None
        print(f"[platform] idle instances reclaimed: {reclaimed}")

    def cold_starts(self, name: str) -> int:
        return self._deployed_of(name).cold_starts

    def _invoke(self, definition: FunctionDefinition, event: TriggerEvent) -> HttpResponse | None:
        deployed = self._deployed_of(definition.name)
        instance = deployed.warm
        if instance is None:
            print(f"[platform] {definition.name}: cold start")
            instance = definition.create()
            deployed.cold_starts += 1
            deployed.warm = instance  # stays warm after this invocation, until reclaim_idle
        else:
            print(f"[platform] {definition.name}: warm")
        return instance.handle(event, self._services)

    def _deployed_of(self, name: str) -> _DeployedFunction:
        for candidate in self._functions:
            if candidate.definition.name == name:
                return candidate
        raise LookupError(f"unknown function {name}")
# [/platform]


# [createOrder]
class CreateOrderInstance:
    def __init__(self) -> None:
        # Instance memory: it survives from one invocation to the next only while the platform
        # keeps this instance warm, and starts at zero again after every cold start. This is
        # exactly the kind of state you must not rely on. The order ids come from the store.
        self._calls = 0

    def handle(self, event: TriggerEvent, services: Services) -> HttpResponse | None:
        match event:
            case HttpEvent():
                pass
            case _:
                raise ValueError(f"createOrder expects an http event, got {event.kind}")
        self._calls += 1

        customer_id = event.body.customer_id
        total_cents = event.body.total_cents
        if total_cents <= 0:
            return HttpResponse(400, f"total must be positive (instance call {self._calls})")

        # Two separate writes: save the order, then enqueue the message. If this instance dies
        # between them, the order exists and nobody is ever told. A real system would close that
        # gap with an outbox or the platform's transactional outputs; this example has neither.
        id = services.orders.next_order_id()
        services.orders.save(Order(id=id, customer_id=customer_id, total_cents=total_cents, status="received"))
        services.queues.enqueue("order-placed", OrderPlaced(order_id=id))
        return HttpResponse(201, f"{id} received (instance call {self._calls})")


create_order = FunctionDefinition(
    name="createOrder",
    trigger=HttpTrigger(route="POST /orders"),
    create=lambda: CreateOrderInstance(),
)
# [/createOrder]


# [sendReceipt]
class SendReceiptInstance:
    """Runs once per order-placed message: reads the order from the store and marks it receipted."""

    def handle(self, event: TriggerEvent, services: Services) -> HttpResponse | None:
        match event:
            case QueueEvent():
                pass
            case _:
                raise ValueError(f"sendReceipt expects a queue event, got {event.kind}")

        order = services.orders.get(event.message.order_id)
        if order is None:
            raise LookupError(f"unknown order {event.message.order_id}")
        print(f"[email] receipt for {order.id} to {order.customer_id}: {format_cents(order.total_cents)}")
        services.orders.save(replace(order, status="receipted"))
        return None


send_receipt = FunctionDefinition(
    name="sendReceipt",
    trigger=QueueTrigger(queue="order-placed"),
    create=lambda: SendReceiptInstance(),
)
# [/sendReceipt]


# [dailyReport]
class DailyReportInstance:
    """Runs when the schedule fires. It only reads: whatever it reports comes from the store."""

    def handle(self, event: TriggerEvent, services: Services) -> HttpResponse | None:
        match event:
            case ScheduleEvent():
                pass
            case _:
                raise ValueError(f"dailyReport expects a schedule event, got {event.kind}")

        orders = services.orders.all()
        total_cents = sum(order.total_cents for order in orders)
        receipted = sum(1 for order in orders if order.status == "receipted")
        print(f"[report] {len(orders)} orders, total {format_cents(total_cents)}, {receipted} receipted")
        return None


daily_report = FunctionDefinition(
    name="dailyReport",
    trigger=ScheduleTrigger(schedule="daily-report"),
    create=lambda: DailyReportInstance(),
)
# [/dailyReport]


# [usage]
services = Services(orders=OrderStore(), queues=MessageQueues())
platform = Platform(services)
platform.register(create_order)
platform.register(send_receipt)
platform.register(daily_report)


def post(customer_id: str, total_cents: int) -> None:
    response = platform.http("POST", "/orders", OrderRequest(customer_id=customer_id, total_cents=total_cents))
    print(f"POST /orders -> {response.status} {response.body}")


# The first request cold-starts createOrder, the next two reuse its warm instance.
post("cust-42", 6997)
post("cust-7", 2999)
post("cust-9", 0)

# Nothing has run sendReceipt yet: the platform does that when it drains the queue.
platform.drain_queues()

# Idle time passes: every instance is dropped, and the call counter with it.
platform.reclaim_idle()
post("cust-42", 1500)

# order-3 is still queued, so the report counts it but sees only two receipted orders.
platform.tick("daily-report")
print(
    f"cold starts: createOrder {platform.cold_starts('createOrder')}, "
    f"sendReceipt {platform.cold_starts('sendReceipt')}, dailyReport {platform.cold_starts('dailyReport')}"
)
# [/usage]
