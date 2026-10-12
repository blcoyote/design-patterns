from __future__ import annotations

from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol, Union


# [messages]
# Everything actors say to each other. An ActorRef is just the actor's name: a string
# address, like an Erlang PID or an Akka ActorRef. A sender never holds the actor object,
# so the only way to reach an actor is to put a message in its mailbox.
ActorRef = str


@dataclass(frozen=True)
class Deposit:
    """Money is integer cents everywhere. reply_to is where the answer goes: the sender never waits for it."""

    amount_cents: int
    reply_to: ActorRef


@dataclass(frozen=True)
class Withdraw:
    amount_cents: int
    reply_to: ActorRef


@dataclass(frozen=True)
class GetBalance:
    reply_to: ActorRef


@dataclass(frozen=True)
class Reply:
    text: str


@dataclass(frozen=True)
class Failed:
    """Sent by the system (never by an actor) to a parent when one of its children crashes."""

    child: ActorRef
    reason: str


Message = Union[Deposit, Withdraw, GetBalance, Reply, Failed]


def format_cents(cents: int) -> str:
    """Formats 7500 as "75.00" and -2500 as "-25.00" with integer arithmetic only (no floats, no thousands separator)."""
    absolute = abs(cents)
    whole = absolute // 100
    fraction = absolute % 100
    sign = "-" if cents < 0 else ""
    return f"{sign}{whole}.{fraction:02d}"
# [/messages]


# [actorSystem]
class ActorContext(Protocol):
    """What the system hands to an actor while it handles one message."""

    @property
    def self_ref(self) -> ActorRef:
        """This actor's own address (named self_ref because self is the method receiver in Python)."""
        ...

    def tell(self, to: ActorRef, message: Message) -> None:
        """Puts a message in another actor's mailbox and returns at once."""
        ...

    def restart(self, child: ActorRef) -> None:
        """Replaces a crashed child with a fresh instance. Meant for supervisors."""
        ...


class Actor(Protocol):
    """
    The actor contract. An actor owns its state privately and handles exactly one message per
    call. A crash is an exception raised out of receive: the actor does no defensive handling,
    its supervisor decides what happens next.
    """

    def receive(self, message: Message, ctx: ActorContext) -> None: ...


@dataclass
class _Cell:
    """Everything the system keeps for one actor: the actor itself plus its mailbox and bookkeeping."""

    name: ActorRef
    # How to build a fresh instance, used by spawn and again by every restart.
    factory: Callable[[], Actor]
    actor: Actor
    parent: ActorRef | None
    # FIFO: messages are appended at the back and popped from the front (popleft).
    mailbox: deque[Message] = field(default_factory=deque)
    # A suspended cell (a crashed actor awaiting its supervisor) is skipped by the scheduler.
    suspended: bool = False
    restarts: int = 0


@dataclass(frozen=True)
class _Context:
    self_ref: ActorRef
    _system: ActorSystem

    def tell(self, to: ActorRef, message: Message) -> None:
        self._system.tell(to, message)

    def restart(self, child: ActorRef) -> None:
        self._system._restart(child)


class ActorSystem:
    """
    The actor system: it owns every mailbox and decides when each actor runs.

    Real runtimes (Erlang/OTP schedulers, Akka dispatchers, Orleans silos, Go goroutines plus
    channels) run many actors concurrently. This scheduler is single-threaded and drains the
    mailboxes in a fixed order, deterministic only so that this example prints the same output
    in every language. There are no threads, tasks or timers here.
    """

    def __init__(self) -> None:
        # Cells in spawn order: that order is the scheduler order.
        self._cells: list[_Cell] = []

    def spawn(self, name: ActorRef, factory: Callable[[], Actor], parent: ActorRef | None = None) -> None:
        self._cells.append(_Cell(name=name, factory=factory, actor=factory(), parent=parent))

    def tell(self, to: ActorRef, message: Message) -> None:
        """Only enqueues. The receiver does not run until the scheduler gives it a turn."""
        self._cell_of(to).mailbox.append(message)

    def mailbox_size(self, name: ActorRef) -> int:
        return len(self._cell_of(name).mailbox)

    def restart_count(self, name: ActorRef) -> int:
        return self._cell_of(name).restarts

    def run(self) -> None:
        """
        Runs in rounds until a round processes nothing. A round walks a snapshot of the cells in
        spawn order, and every cell that is not suspended and has mail handles exactly ONE
        message. That is how "one message at a time per actor" and fair interleaving appear.
        """
        processed_any = True
        while processed_any:
            processed_any = False
            for cell in list(self._cells):
                if cell.suspended:
                    continue
                if not cell.mailbox:
                    continue
                message = cell.mailbox.popleft()
                processed_any = True
                self._deliver(cell, message)

    def _deliver(self, cell: _Cell, message: Message) -> None:
        ctx = _Context(self_ref=cell.name, _system=self)
        try:
            cell.actor.receive(message, ctx)
        except Exception as exc:
            # The crashed message is dropped (it is not retried) but the rest of the mailbox is kept.
            # The cell is suspended until its supervisor restarts it, and the parent hears about it
            # by message. A cell without a parent just stays suspended.
            cell.suspended = True
            if cell.parent is not None:
                self.tell(cell.parent, Failed(child=cell.name, reason=str(exc)))

    def _restart(self, child: ActorRef) -> None:
        """A fresh instance from the factory: state starts over, the old instance is simply discarded."""
        cell = self._cell_of(child)
        cell.actor = cell.factory()
        cell.suspended = False
        cell.restarts += 1

    def _cell_of(self, name: ActorRef) -> _Cell:
        for candidate in self._cells:
            if candidate.name == name:
                return candidate
        raise LookupError(f"unknown actor {name}")
# [/actorSystem]


# [account]
class AccountActor:
    """
    Owns a balance that nothing else can touch: the only way to read or change it is a message.
    It never prints; it answers by telling reply_to. It also does no defensive handling of a bad
    amount (a deposit or withdrawal of 0 or less): it raises and lets the supervisor deal with it ("let it crash").
    """

    def __init__(self) -> None:
        self._balance_cents = 0

    def receive(self, message: Message, ctx: ActorContext) -> None:
        match message:
            case Deposit():
                if message.amount_cents <= 0:
                    raise ValueError(f"invalid amount {format_cents(message.amount_cents)}")
                self._balance_cents += message.amount_cents
                ctx.tell(
                    message.reply_to,
                    Reply(
                        f"deposit {format_cents(message.amount_cents)} ok, balance {format_cents(self._balance_cents)}"
                    ),
                )
            case Withdraw():
                if message.amount_cents <= 0:
                    raise ValueError(f"invalid amount {format_cents(message.amount_cents)}")
                # Not enough money is a business outcome, so it is a normal reply and not a crash.
                if message.amount_cents > self._balance_cents:
                    ctx.tell(
                        message.reply_to,
                        Reply(
                            f"withdraw {format_cents(message.amount_cents)} rejected, balance {format_cents(self._balance_cents)}"
                        ),
                    )
                    return
                self._balance_cents -= message.amount_cents
                ctx.tell(
                    message.reply_to,
                    Reply(
                        f"withdraw {format_cents(message.amount_cents)} ok, balance {format_cents(self._balance_cents)}"
                    ),
                )
            case GetBalance():
                ctx.tell(message.reply_to, Reply(f"balance {format_cents(self._balance_cents)}"))
            case Reply() | Failed():
                return  # not addressed to an account: ignored
# [/account]


# [teller]
class TellerActor:
    """Receives the answers. It is the only actor that prints, and it never touches the account's state."""

    def receive(self, message: Message, ctx: ActorContext) -> None:
        match message:
            case Reply():
                print(f"[teller] {message.text}")
            case Deposit() | Withdraw() | GetBalance() | Failed():
                return  # not addressed to a teller: ignored
# [/teller]


# [supervisor]
class SupervisorActor:
    """
    Watches over its children. When one crashes it restarts just that one, leaving its siblings
    alone: the one-for-one strategy (Erlang's one_for_one). The restarted child starts from
    scratch, so whatever was only in its memory is gone.
    """

    def receive(self, message: Message, ctx: ActorContext) -> None:
        match message:
            case Failed():
                print(f"[supervisor] {message.child} crashed ({message.reason}), restarting it")
                ctx.restart(message.child)
            case Deposit() | Withdraw() | GetBalance() | Reply():
                return  # not addressed to a supervisor: ignored
# [/supervisor]


# [usage]
system = ActorSystem()
# Spawn order is the scheduler order. The account is the supervisor's child.
system.spawn("supervisor", lambda: SupervisorActor())
system.spawn("teller", lambda: TellerActor())
system.spawn("account", lambda: AccountActor(), "supervisor")

# tell only enqueues: nothing has run yet.
system.tell("account", Deposit(amount_cents=10000, reply_to="teller"))
system.tell("account", Withdraw(amount_cents=2500, reply_to="teller"))
system.tell("account", Withdraw(amount_cents=20000, reply_to="teller"))
system.tell("account", GetBalance(reply_to="teller"))
print(f"account mailbox: {system.mailbox_size('account')} messages, none processed yet")
system.run()

# A bad deposit crashes the account. The supervisor restarts it with a fresh balance, and the
# GetBalance that was already waiting in its mailbox is answered by the new instance.
system.tell("account", Deposit(amount_cents=0, reply_to="teller"))
system.tell("account", GetBalance(reply_to="teller"))
system.run()
print(f"account restarts: {system.restart_count('account')}")
# [/usage]
