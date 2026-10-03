# In production Python you might reach for a signals library (blinker) or
# plain callbacks instead of hand-rolling this, but we keep the explicit
# pattern structure here for clarity.
from typing import Protocol


# [observer]
class Observer(Protocol):
    def update(self, price: float) -> None: ...
# [/observer]


# [subject]
class StockTicker:
    def __init__(self) -> None:
        self._observers: list[Observer] = []
        self._price = 0.0

    # [subscribe]
    def subscribe(self, observer: Observer) -> None:
        self._observers.append(observer)
    # [/subscribe]

    # [unsubscribe]
    def unsubscribe(self, observer: Observer) -> None:
        self._observers = [o for o in self._observers if o is not observer]
    # [/unsubscribe]

    # [setPrice]
    def set_price(self, price: float) -> None:
        self._price = price
        self._notify()
    # [/setPrice]

    # [notify]
    def _notify(self) -> None:
        # Loop over a snapshot so an observer that subscribes or unsubscribes
        # mid-notify doesn't affect the round we're already delivering.
        for observer in list(self._observers):
            observer.update(self._price)
    # [/notify]
# [/subject]


# [concrete]
# [chart]
class PriceChart:
    def update(self, price: float) -> None:
        print(f"chart: plot {price}")
# [/chart]


# [alert]
class PriceAlert:
    def __init__(self, limit: float) -> None:
        self._limit = limit

    def update(self, price: float) -> None:
        if price > self._limit:
            print(f"warning: price above {self._limit}!")
# [/alert]


# [logger]
class AuditLog:
    def __init__(self) -> None:
        self.entries: list[float] = []

    def update(self, price: float) -> None:
        self.entries.append(price)
# [/logger]
# [/concrete]


# Usage
ticker = StockTicker()
alert = PriceAlert(100)
ticker.subscribe(PriceChart())
ticker.subscribe(alert)
ticker.subscribe(AuditLog())

ticker.set_price(101.5)  # all three react
ticker.unsubscribe(alert)
ticker.set_price(99)  # only chart + log
