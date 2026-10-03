import asyncio
from collections.abc import Awaitable, Callable
from enum import Enum, auto
from typing import TypeVar

T = TypeVar('T')


# [clock]
class Clock:
    """A fake clock: time only moves when the usage code calls advance(). No real time anywhere."""

    def __init__(self) -> None:
        self.now_ms = 0

    def advance(self, ms: int) -> None:
        self.now_ms += ms
# [/clock]


# [service]
class RemoteService:
    """A downstream dependency that can start failing under load."""

    def __init__(self) -> None:
        self.healthy = True  # flipped by the usage code to simulate an outage and a recovery
        self.calls = 0

    async def request(self) -> str:
        self.calls += 1
        if not self.healthy:
            raise RuntimeError('service unavailable')
        return 'ok'
# [/service]


class BreakerState(Enum):
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


# [breaker]
class CircuitBreaker:
    def __init__(self, clock: Clock, failure_threshold: int, cooldown_ms: int) -> None:
        self._clock = clock
        self._failure_threshold = failure_threshold
        self._cooldown_ms = cooldown_ms
        self._state = BreakerState.CLOSED
        self._failure_count = 0
        self._next_attempt = 0
        self._trial_in_flight = False
        # Bumped whenever the breaker opens or enters Half-Open, so a slow call that
        # started in an earlier state can't drive a transition it never observed.
        self._generation = 0

    # Read-only views for the usage printout.
    @property
    def state(self) -> BreakerState:
        return self._state

    @property
    def status(self) -> str:
        return f'{self._state.name}, failures: {self._failure_count}/{self._failure_threshold}'

    # [call]
    async def call(self, fn: Callable[[], Awaitable[T]]) -> T:
        # [openCheck]
        if self._state == BreakerState.OPEN:
            if self._clock.now_ms < self._next_attempt:
                raise RuntimeError('circuit open, failing fast')  # fn() never runs
            # [halfOpenCheck]
            self._state = BreakerState.HALF_OPEN  # cooldown elapsed: let exactly one trial through
            self._generation += 1
            # [/halfOpenCheck]
        # Only one probe at a time: while it is in flight, everyone else keeps failing fast.
        if self._state == BreakerState.HALF_OPEN and self._trial_in_flight:
            raise RuntimeError('circuit half-open, trial in progress')
        # [/openCheck]

        is_trial = self._state == BreakerState.HALF_OPEN
        call_generation = self._generation  # only *this* call's own outcome may move that generation on
        if is_trial:
            self._trial_in_flight = True
        try:
            # [invoke]
            result = await fn()
            # [/invoke]
            # [onSuccess]
            if call_generation == self._generation:
                self._failure_count = 0
                self._state = BreakerState.CLOSED
            # [/onSuccess]
            return result
        except Exception:
            # [onFailure]
            if call_generation == self._generation:
                if self._state == BreakerState.HALF_OPEN:
                    self._trip()  # the trial failed: straight back to Open
                else:
                    self._failure_count += 1
                    if self._failure_count >= self._failure_threshold:
                        self._trip()
            # [/onFailure]
            raise
        finally:
            if is_trial:
                self._trial_in_flight = False
    # [/call]

    def _trip(self) -> None:
        self._state = BreakerState.OPEN
        self._next_attempt = self._clock.now_ms + self._cooldown_ms
        self._generation += 1
# [/breaker]


# [client]
# Usage
COOLDOWN_MS = 4000


async def main() -> None:
    clock = Clock()
    service = RemoteService()
    breaker = CircuitBreaker(clock, failure_threshold=3, cooldown_ms=COOLDOWN_MS)

    async def attempt(label: str) -> None:
        ran_while: BreakerState | None = None

        async def fn() -> str:
            nonlocal ran_while
            ran_while = breaker.state  # only set if the breaker actually lets fn() run
            return await service.request()

        try:
            outcome = await breaker.call(fn)
        except RuntimeError as err:
            outcome = str(err)
        ran = f'fn ran while {ran_while.name}' if ran_while is not None else 'fn never ran'
        print(f'{label}: {outcome} ({ran}) -> {breaker.status}, service calls: {service.calls}')

    await attempt('call 1')  # ok (fn ran while CLOSED) -> CLOSED, failures: 0/3, service calls: 1
    service.healthy = False
    await attempt('call 2')  # service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 2
    await attempt('call 3')  # service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 3
    await attempt('call 4')  # service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 4
    await attempt('call 5')  # circuit open, failing fast (fn never ran) -> OPEN, failures: 3/3, service calls: 4

    clock.advance(COOLDOWN_MS)
    service.healthy = True
    # Nothing has changed yet: Open only notices the elapsed cooldown on the next call.
    print(f'cooldown elapsed -> {breaker.status}')  # OPEN, failures: 3/3
    await attempt('call 6')  # ok (fn ran while HALF_OPEN) -> CLOSED, failures: 0/3, service calls: 5

    # Later: a fresh failure streak trips it again, and this time the trial fails too.
    service.healthy = False
    await attempt('call 7')  # service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 6
    await attempt('call 8')  # service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 7
    await attempt('call 9')  # service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 8
    clock.advance(COOLDOWN_MS)
    await attempt('call 10')  # service unavailable (fn ran while HALF_OPEN) -> OPEN, failures: 3/3, service calls: 9


asyncio.run(main())
# [/client]
