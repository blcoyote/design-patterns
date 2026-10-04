from __future__ import annotations

import threading
from dataclasses import dataclass, replace
from functools import reduce
from typing import Callable

# Domain: a bank account, modeled the event-sourced way. Nothing here is a class with
# mutable fields -- state is always *derived* from the events that happened to it.


@dataclass(frozen=True)
class OpenAccount:
    owner: str


@dataclass(frozen=True)
class Deposit:
    amount: int


@dataclass(frozen=True)
class Withdraw:
    amount: int


Command = OpenAccount | Deposit | Withdraw


@dataclass(frozen=True)
class AccountOpened:
    owner: str


@dataclass(frozen=True)
class Deposited:
    amount: int


@dataclass(frozen=True)
class Withdrawn:
    amount: int


Event = AccountOpened | Deposited | Withdrawn


@dataclass(frozen=True)
class Account:
    owner: str | None = None
    balance: int = 0


INITIAL = Account()


# [evolve]
# evolve(state, event) -> state: a pure, total function with no branch that can fail.
# It only ever applies an event that already happened -- it never judges whether it should have.
def evolve(state: Account, event: Event) -> Account:
    match event:
        case AccountOpened(owner=owner):
            return replace(state, owner=owner)
        case Deposited(amount=amount):
            return replace(state, balance=state.balance + amount)
        case Withdrawn(amount=amount):
            return replace(state, balance=state.balance - amount)
# [/evolve]


# [decide]
# decide(command, state) -> list[Event]: the only place business rules live. It looks at the
# *current* state (rebuilt from history) and either returns the events that should happen,
# or raises to reject the command. It never mutates anything itself.
def decide(command: Command, state: Account) -> list[Event]:
    match command:
        case OpenAccount(owner=owner):
            if state.owner is not None:
                raise ValueError("account already open")
            return [AccountOpened(owner)]
        case Deposit(amount=amount):
            return [Deposited(amount)]
        case Withdraw(amount=amount):
            if amount > state.balance:
                raise ValueError("insufficient funds")
            return [Withdrawn(amount)]
# [/decide]


# [fold]
# Replay: rebuild current state by folding every event in the stream over evolve, starting
# from INITIAL. This is the only way state ever comes into being -- there is no separate
# "save the current balance" step.
def fold(events: list[Event]) -> Account:
    return reduce(evolve, events, INITIAL)
# [/fold]


# [append]
# EventStore: an append-only log, keyed by stream id. append() enforces optimistic
# concurrency -- the caller must say which version it last read, and the append is
# rejected if the stream moved on in the meantime.
class EventStore:
    def __init__(self) -> None:
        # One lock makes the version check and the write a single atomic step, so two
        # concurrent appends at the same expected version cannot both succeed.
        self._lock = threading.Lock()
        self._streams: dict[str, list[Event]] = {}
        self._subscribers: list[Callable[[str, Event], None]] = []

    def load(self, stream_id: str) -> list[Event]:
        with self._lock:
            return list(self._streams.get(stream_id, []))

    def append(self, stream_id: str, expected_version: int, events: list[Event]) -> None:
        with self._lock:
            existing = self._streams.get(stream_id, [])
            if len(existing) != expected_version:
                raise ValueError(
                    f"concurrency conflict: expected version {expected_version}, found {len(existing)}"
                )
            self._streams[stream_id] = existing + events
            # Notify while still holding the lock, so subscribers see events in commit order
            # (a subscriber must therefore never append back to this store).
            for event in events:
                for subscriber in self._subscribers:
                    subscriber(stream_id, event)

    def subscribe(self, fn: Callable[[str, Event], None]) -> None:
        with self._lock:
            self._subscribers.append(fn)
# [/append]


# [snapshot]
# Snapshot: a cached fold result at a known version, so replay does not have to start
# from event zero every time. Taking one never changes behavior, only replay cost.
@dataclass(frozen=True)
class Snapshot:
    version: int
    state: Account


def load_with_snapshot(store: EventStore, stream_id: str, snapshot: Snapshot | None) -> Account:
    all_events = store.load(stream_id)
    new_events = all_events[snapshot.version:] if snapshot else all_events
    return reduce(evolve, new_events, snapshot.state if snapshot else INITIAL)
# [/snapshot]


# [projection]
# Projection: a read model that subscribes to the stream and evolves its own shape --
# here, just a running count of withdrawals -- independently of the write-side Account.
class WithdrawalCountProjection:
    def __init__(self) -> None:
        self.count = 0

    def handle(self, stream_id: str, event: Event) -> None:
        if isinstance(event, Withdrawn):
            self.count += 1
# [/projection]


# Usage
store = EventStore()
projection = WithdrawalCountProjection()
store.subscribe(projection.handle)

STREAM_ID = "account-42"


# [handle]
# The command handler is the imperative shell around the pure core: load the stream,
# fold it, decide, then append at the version that was loaded. If another writer
# appended in between, the store sees a different length and rejects the append.
def handle(command: Command) -> None:
    history = store.load(STREAM_ID)
    state = fold(history)
    events = decide(command, state)
    store.append(STREAM_ID, len(history), events)
# [/handle]


handle(OpenAccount("Ada"))
handle(Deposit(100))
handle(Withdraw(30))

print("balance:", fold(store.load(STREAM_ID)).balance)
print("withdrawals so far:", projection.count)

# Snapshot avoids replaying from event zero on the next read.
snapshot = Snapshot(len(store.load(STREAM_ID)), fold(store.load(STREAM_ID)))
handle(Deposit(50))
print("balance via snapshot + newer events:", load_with_snapshot(store, STREAM_ID, snapshot).balance)
