# [bulkhead]
class Bulkhead:
    """A fixed number of concurrent-call slots, used by one dependency or shared by several."""

    def __init__(self, name: str, max_concurrent: int) -> None:
        self.name = name
        self.max_concurrent = max_concurrent
        self.in_flight = 0
        self.rejected = 0

    # There is no waiting queue: a full bulkhead rejects at once. Real ones often
    # allow a short wait or a bounded queue before rejecting.
    def try_acquire(self) -> bool:
        if self.in_flight >= self.max_concurrent:
            self.rejected += 1  # a rejected call never takes a slot
            return False
        self.in_flight += 1
        return True

    def release(self) -> None:
        if self.in_flight == 0:
            raise RuntimeError(f'{self.name}: release without a matching acquire')
        self.in_flight -= 1
# [/bulkhead]


# [dependency]
# Concurrency is simulated: a started call stays in flight until the calling code
# finishes it, which stands in for a slow response. There are no threads, timers or
# awaits. Real calls finish on their own on many threads, so a real limiter must be
# thread-safe (atomic counters or a semaphore).
class Dependency:
    def __init__(self, name: str, bulkhead: Bulkhead) -> None:
        self.name = name
        self._bulkhead = bulkhead
        self._in_flight_ids: list[str] = []

    def start(self, call_id: str) -> bool:
        if not self._bulkhead.try_acquire():
            print(
                f'[{self.name}] {call_id} rejected: {self._bulkhead.name} is full '
                f'({self._bulkhead.in_flight}/{self._bulkhead.max_concurrent})'
            )
            return False
        self._in_flight_ids.append(call_id)
        print(
            f'[{self.name}] {call_id} started ({self._bulkhead.name} '
            f'{self._bulkhead.in_flight}/{self._bulkhead.max_concurrent})'
        )
        return True

    def finish(self, call_id: str) -> None:
        if call_id not in self._in_flight_ids:
            raise RuntimeError(f'{self.name}: {call_id} is not in flight')
        self._in_flight_ids.pop(self._in_flight_ids.index(call_id))  # removes the first match only
        self._bulkhead.release()
        print(
            f'[{self.name}] {call_id} finished ({self._bulkhead.name} '
            f'{self._bulkhead.in_flight}/{self._bulkhead.max_concurrent})'
        )
# [/dependency]


# [shared]
def run_shared() -> Bulkhead:
    print('--- shared pool (no bulkhead), limit 4 ---')
    shared = Bulkhead('shared', 4)
    payments = Dependency('payments', shared)
    recommendations = Dependency('recommendations', shared)

    # Recommendations is slow: its calls stay in flight.
    recommendations.start('r1')
    recommendations.start('r2')
    recommendations.start('r3')
    recommendations.start('r4')

    # One slow dependency used up the slots that payments needed.
    payments.start('p1')  # rejected
    return shared
# [/shared]


# [isolated]
def run_isolated() -> tuple[Bulkhead, Bulkhead]:
    print('--- one bulkhead per dependency, 2 slots each ---')
    payments_bulkhead = Bulkhead('payments', 2)
    recs_bulkhead = Bulkhead('recommendations', 2)
    payments = Dependency('payments', payments_bulkhead)
    recommendations = Dependency('recommendations', recs_bulkhead)

    recommendations.start('r1')
    recommendations.start('r2')
    recommendations.start('r3')  # rejected: only recommendations is full

    payments.start('p1')  # unaffected by the slow dependency
    payments.finish('p1')

    recommendations.finish('r1')  # frees a slot...
    recommendations.start('r4')  # ...which the next call reuses
    return payments_bulkhead, recs_bulkhead
# [/isolated]


# [usage]
# Usage
shared_bulkhead = run_shared()
payments_bulkhead, recs_bulkhead = run_isolated()
print(
    f'rejected: shared {shared_bulkhead.rejected}, payments {payments_bulkhead.rejected}, '
    f'recommendations {recs_bulkhead.rejected}'
)
# [/usage]
