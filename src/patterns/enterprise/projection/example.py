from dataclasses import dataclass


# One kind of fact per event. A real system would use one type per event; a
# single shape keeps this example short.
@dataclass(frozen=True)
class OrderEvent:
    type: str  # 'OrderPlaced' or 'OrderCancelled'
    order_id: str
    customer_id: str
    total: int


@dataclass(frozen=True)
class LoggedEvent:
    position: int
    event: OrderEvent


# [eventLog]
# The source of truth: an append-only log. Positions are counters, so they are
# stable and ordered.
class EventLog:
    def __init__(self) -> None:
        self._entries: list[LoggedEvent] = []

    # [logAppend]
    def append(self, event: OrderEvent) -> int:
        position = len(self._entries) + 1
        self._entries.append(LoggedEvent(position, event))
        print(f'log: #{position} {event.type} {event.order_id}')
        return position
    # [/logAppend]

    # [logRead]
    # A list comprehension builds a new list, so callers iterate a snapshot.
    def read_after(self, position: int) -> list[LoggedEvent]:
        return [entry for entry in self._entries if entry.position > position]
    # [/logRead]
# [/eventLog]


# [readModel]
@dataclass
class CustomerRow:
    orders: int
    spent: int


# A disposable read model shaped for one question: how much has each customer
# ordered? It can be deleted and rebuilt from the log at any time.
class CustomerSummaryView:
    def __init__(self) -> None:
        self._rows: dict[str, CustomerRow] = {}
        # The position of the last event applied. It is stored with the data it
        # describes (a real store updates both in one transaction).
        self.checkpoint = 0

    # [viewApply]
    def apply(self, logged: LoggedEvent) -> None:
        # A position at or below the checkpoint was already applied, so a
        # redelivered event changes nothing.
        if logged.position <= self.checkpoint:
            print(f'view: #{logged.position} already applied, ignored')
            return
        event = logged.event
        row = self._rows.get(event.customer_id, CustomerRow(0, 0))
        sign = 1 if event.type == 'OrderPlaced' else -1
        self._rows[event.customer_id] = CustomerRow(row.orders + sign, row.spent + sign * event.total)
        self.checkpoint = logged.position
    # [/viewApply]

    # [viewGet]
    def get(self, customer_id: str) -> CustomerRow | None:
        return self._rows.get(customer_id)
    # [/viewGet]

    # [viewReset]
    def reset(self) -> None:
        self._rows.clear()
        self.checkpoint = 0
    # [/viewReset]
# [/readModel]


# [projector]
# The only writer of the read model. It never decides anything: it replays what
# the log says happened.
class Projector:
    def __init__(self, log: EventLog, view: CustomerSummaryView) -> None:
        self._log = log
        self._view = view

    # [catchUp]
    # Pull everything after the view's own checkpoint and apply it in order.
    # A real projector runs this on a schedule or when it is notified.
    def catch_up(self) -> None:
        pending = self._log.read_after(self._view.checkpoint)
        for logged in pending:
            self._view.apply(logged)
        print(f'projector: applied {len(pending)} event(s) (checkpoint {self._view.checkpoint})')
    # [/catchUp]

    # [rebuild]
    # Throw the read model away and replay the whole log into it.
    def rebuild(self) -> None:
        self._view.reset()
        print('projector: view reset')
        self.catch_up()
    # [/rebuild]
# [/projector]


# [client]
log = EventLog()
view = CustomerSummaryView()
projector = Projector(log, view)


def show(customer_id: str) -> None:
    row = view.get(customer_id)
    print(f'{customer_id}: orders={row.orders} spent={row.spent}' if row else f'{customer_id}: no row yet')


log.append(OrderEvent('OrderPlaced', 'o1', 'ada', 40))
# log: #1 OrderPlaced o1
log.append(OrderEvent('OrderPlaced', 'o2', 'grace', 25))
# log: #2 OrderPlaced o2
log.append(OrderEvent('OrderPlaced', 'o3', 'ada', 35))
# log: #3 OrderPlaced o3
show('ada')  # the read model has not caught up yet
# ada: no row yet

projector.catch_up()
# projector: applied 3 event(s) (checkpoint 3)
show('ada')
# ada: orders=2 spent=75
show('grace')
# grace: orders=1 spent=25

log.append(OrderEvent('OrderCancelled', 'o1', 'ada', 40))
# log: #4 OrderCancelled o1
projector.catch_up()
# projector: applied 1 event(s) (checkpoint 4)
show('ada')
# ada: orders=1 spent=35

view.apply(log.read_after(3)[0])  # the same event delivered a second time
# view: #4 already applied, ignored

projector.rebuild()
# projector: view reset
# projector: applied 4 event(s) (checkpoint 4)
show('ada')
# ada: orders=1 spent=35
show('grace')
# grace: orders=1 spent=25
# [/client]
