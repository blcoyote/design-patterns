from dataclasses import dataclass


# [sleeper]
class FakeSleeper:
    """A fake sleeper: sleep() only adds up the time, nothing really waits."""

    def __init__(self) -> None:
        self.total_ms = 0

    def sleep(self, ms: int) -> None:
        self.total_ms += ms


# [/sleeper]


# [jitter]
class ScriptedJitter:
    """
    Scripted jitter, so the output is the same on every run: percentages 0-100 handed out
    in order and never reset. A real client draws them at random (full jitter is a uniform
    pick between 0 and the ceiling).
    """

    def __init__(self, percents: list[int]) -> None:
        self._percents = percents
        self._next = 0

    def next_percent(self) -> int:
        percent = self._percents[self._next % len(self._percents)]
        self._next += 1
        return percent


# [/jitter]


# [service]
class ApiError(Exception):
    def __init__(self, status: int) -> None:
        super().__init__(f"HTTP {status}")
        self.status = status


class FlakyService:
    """GET /inventory (idempotent). The script lists the status of each call; the last one repeats."""

    def __init__(self, script: list[int]) -> None:
        self._script = script
        self._calls = 0

    def get(self) -> str:
        status = self._script[min(self._calls, len(self._script) - 1)]
        self._calls += 1
        if status >= 400:
            raise ApiError(status)
        return "inventory: 12 items"


# [/service]


# [policy]
@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int
    base_ms: int
    cap_ms: int

    def ceiling_ms(self, attempt: int) -> int:
        """Exponential backoff: base, 2 x base, 4 x base ..., never above the cap."""
        return min(self.cap_ms, self.base_ms * 2 ** (attempt - 1))


# [/policy]


@dataclass(frozen=True)
class Outcome:
    ok: bool
    attempts: int
    waited_ms: int
    status: int


# [retrier]
class Retrier:
    def __init__(self, policy: RetryPolicy, jitter: ScriptedJitter, sleeper: FakeSleeper) -> None:
        self._policy = policy
        self._jitter = jitter
        self._sleeper = sleeper

    def execute(self, fn) -> Outcome:
        slept_before = self._sleeper.total_ms

        def outcome(ok: bool, attempts: int, status: int) -> Outcome:
            return Outcome(ok, attempts, self._sleeper.total_ms - slept_before, status)

        attempt = 0
        while True:
            attempt += 1
            # [attempt]
            try:
                fn()
                print(f"attempt {attempt}: ok")
                return outcome(True, attempt, 200)
            except ApiError as err:
                # [classify]
                # This example treats every status below 500 as final; real policies also retry 408 and 429.
                if err.status < 500:
                    print(f"attempt {attempt}: {err.status} -> not retryable")
                    return outcome(False, attempt, err.status)
                # [/classify]
                # [giveUp]
                if attempt == self._policy.max_attempts:
                    print(f"attempt {attempt}: {err.status} -> giving up")
                    return outcome(False, attempt, err.status)
                # [/giveUp]
                # [wait]
                ceiling = self._policy.ceiling_ms(attempt)
                delay = ceiling * self._jitter.next_percent() // 100
                print(f"attempt {attempt}: {err.status} -> retry in {delay}ms (ceiling {ceiling}ms)")
                self._sleeper.sleep(delay)
                # [/wait]
            # [/attempt]


# [/retrier]


# [client]
# Usage
def describe(o: Outcome) -> str:
    tail = f"attempts {o.attempts}, waited {o.waited_ms}ms"
    if o.ok:
        return f"ok, {tail}"
    if o.status >= 500:
        return f"gave up ({o.status}), {tail}"
    return f"failed ({o.status}, not retryable), {tail}"


retrier = Retrier(
    RetryPolicy(max_attempts=4, base_ms=100, cap_ms=400),
    ScriptedJitter([50, 25, 75, 40, 90, 10]),
    FakeSleeper(),
)


def call(title: str, script: list[int]) -> None:
    print(f"--- {title} ---")
    service = FlakyService(script)
    print(f"result: {describe(retrier.execute(service.get))}")


call("call 1: succeeds on attempt 4", [503, 503, 503, 200])
call("call 2: always fails", [503])
call("call 3: bad request", [400])
# [/client]
