from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from typing import Protocol, Union


# [domain]
@dataclass(frozen=True)
class Account:
    id: str
    email: str
    invoice_cents: int
    due_at: datetime
    last_reminder_at: datetime | None
# [/domain]


# [effects]
# An effect is a description of something to do in the outside world — not the
# doing of it. The core only ever builds these; it never sends an email itself.
@dataclass(frozen=True)
class SendEmail:
    to: str
    subject: str
    body: str


@dataclass(frozen=True)
class MarkReminded:
    account_id: str
    at: datetime


Effect = Union[SendEmail, MarkReminded]


@dataclass(frozen=True)
class Decision:
    action: str
    effects: tuple[Effect, ...]
# [/effects]


# [core]
GRACE_DAYS = 3


def decide_reminder(account: Account, now: datetime) -> Decision:
    """The pure core. Same (account, now) in, same Decision out, forever — no
    datetime.now(), no database call, no network request hiding inside it. `now`
    arrives as a plain value instead of being read from a clock, which is what
    makes this testable without mocking time."""
    overdue = now - account.due_at
    is_overdue = overdue > timedelta(days=GRACE_DAYS)
    reminded_today = account.last_reminder_at is not None and (now - account.last_reminder_at) < timedelta(days=1)

    if not is_overdue or reminded_today:
        return Decision(action="skip", effects=())

    amount = f"{account.invoice_cents / 100:.2f}"
    return Decision(
        action="remind",
        effects=(
            SendEmail(
                to=account.email,
                subject="Your invoice is overdue",
                body=f"Invoice of ${amount} was due {account.due_at:%Y-%m-%d}.",
            ),
            MarkReminded(account_id=account.id, at=now),
        ),
    )
# [/core]


# [shell]
class AccountStore(Protocol):
    def load(self, account_id: str) -> Account: ...
    def save(self, account: Account) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...


class Mailer(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...


class ReminderHandler:
    """The imperative shell. It gathers plain values (load the account, read the
    clock), hands them to the pure core, and then interprets whatever effects come
    back by walking the list and performing the matching I/O — one match arm per
    effect type. None of the decision logic lives here; all of the side effects do.
    """

    def __init__(self, accounts: AccountStore, clock: Clock, mailer: Mailer) -> None:
        self._accounts = accounts
        self._clock = clock
        self._mailer = mailer

    def handle(self, account_id: str) -> Decision:
        account = self._accounts.load(account_id)
        now = self._clock.now()

        decision = decide_reminder(account, now)

        for effect in decision.effects:
            match effect:
                case SendEmail(to=to, subject=subject, body=body):
                    self._mailer.send(to, subject, body)
                case MarkReminded(at=at):
                    self._accounts.save(replace(account, last_reminder_at=at))

        return decision
# [/shell]


# [test]
# Testing the core needs no mocks, no fake clock class, no in-memory database —
# just values in, a value out, compared with ==.
test_account = Account(
    id="acc-1",
    email="ops@example.com",
    invoice_cents=4200,
    due_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
    last_reminder_at=None,
)
test_now = datetime(2026, 9, 10, tzinfo=timezone.utc)

test_decision = decide_reminder(test_account, test_now)
print(f"core test: {test_decision.action} {len(test_decision.effects)} effect(s)")
# [/test]


# Usage: the shell wired up with concrete (if deterministic, for this demo) adapters.
class InMemoryAccounts:
    def __init__(self, account: Account) -> None:
        self._account = account

    def load(self, account_id: str) -> Account:
        return self._account

    def save(self, account: Account) -> None:
        self._account = account
        last = account.last_reminder_at
        stamp = f"{last.strftime('%Y-%m-%dT%H:%M:%S')}.{last.microsecond // 1000:03d}Z" if last is not None else "null"
        print(f"saved account {account.id} - last reminded {stamp}")


class FixedClock:
    def __init__(self, value: datetime) -> None:
        self._value = value

    def now(self) -> datetime:
        return self._value


class ConsoleMailer:
    def send(self, to: str, subject: str, body: str) -> None:
        print(f"email -> {to} : {subject}\n  {body}")


handler = ReminderHandler(InMemoryAccounts(test_account), FixedClock(test_now), ConsoleMailer())
handler.handle("acc-1")
