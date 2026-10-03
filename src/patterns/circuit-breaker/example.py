import asyncio
import time
from collections.abc import Awaitable, Callable
from enum import Enum, auto
from typing import TypeVar

T = TypeVar('T')


# [service]
class RemoteService:
    """A downstream dependency that can start failing under load."""

    def __init__(self, is_healthy: Callable[[], bool]) -> None:
        self._is_healthy = is_healthy

    async def request(self) -> str:
        if not self._is_healthy():
            raise RuntimeError('service unavailable')
        return 'ok'
# [/service]


class BreakerState(Enum):
    CLOSED = auto()
    OPEN = auto()
    HALF_OPEN = auto()


# [breaker]
class CircuitBreaker:
    def __init__(self, failure_threshold: int, cooldown_ms: float) -> None:
        self._failure_threshold = failure_threshold
        self._cooldown_ms = cooldown_ms
        self._state = BreakerState.CLOSED
        self._failure_count = 0
        self._next_attempt = 0.0
        self._trial_in_flight = False
        # Bumped on every state transition, so a slow call that started in an
        # earlier state can't drive a transition it never actually observed.
        self._generation = 0

    # [call]
    async def call(self, fn: Callable[[], Awaitable[T]]) -> T:
        # [openCheck]
        if self._state == BreakerState.OPEN:
            if time.monotonic() * 1000 < self._next_attempt:
                raise RuntimeError('circuit open — failing fast')  # fn() never runs
            # [halfOpenCheck]
            self._state = BreakerState.HALF_OPEN  # cooldown elapsed: let exactly one trial through
            self._generation += 1
            # [/halfOpenCheck]
        # Only one probe at a time: while it is in flight, everyone else keeps failing fast.
        if self._state == BreakerState.HALF_OPEN and self._trial_in_flight:
            raise RuntimeError('circuit half-open — trial in progress')
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
                self._failure_count += 1
                if self._state == BreakerState.HALF_OPEN or self._failure_count >= self._failure_threshold:
                    self._state = BreakerState.OPEN
                    self._next_attempt = time.monotonic() * 1000 + self._cooldown_ms
                    self._generation += 1
            # [/onFailure]
            raise
        finally:
            if is_trial:
                self._trial_in_flight = False
    # [/call]
# [/breaker]


# [client]
# Usage
async def main() -> None:
    service_is_healthy = True
    service = RemoteService(lambda: service_is_healthy)
    breaker = CircuitBreaker(failure_threshold=3, cooldown_ms=4000)

    await breaker.call(service.request)


asyncio.run(main())
# [/client]
