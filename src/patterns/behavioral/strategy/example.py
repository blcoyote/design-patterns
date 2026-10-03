from dataclasses import dataclass
from typing import Protocol


# [routeStrategy]
class RouteStrategy(Protocol):
    def calculate(self, from_: str, to: str) -> "Route": ...
# [/routeStrategy]


@dataclass
class Route:
    minutes: int
    summary: str


# [fastest]
class FastestRoute:
    def calculate(self, from_: str, to: str) -> Route:
        return Route(minutes=12, summary=f"highway from {from_} to {to}")
# [/fastest]


# [shortest]
class ShortestRoute:
    def calculate(self, from_: str, to: str) -> Route:
        return Route(minutes=18, summary=f"direct path from {from_} to {to}")
# [/shortest]


# [scenic]
class ScenicRoute:
    def calculate(self, from_: str, to: str) -> Route:
        return Route(minutes=35, summary=f"coastal road from {from_} to {to}")
# [/scenic]


# [navigator]
class Navigator:
    # [holds]
    def __init__(self, strategy: RouteStrategy) -> None:
        self._strategy = strategy
    # [/holds]

    # [setStrategy]
    def set_strategy(self, strategy: RouteStrategy) -> None:
        self._strategy = strategy
    # [/setStrategy]

    # [route]
    def route(self, from_: str, to: str) -> Route:
        return self._strategy.calculate(from_, to)
    # [/route]
# [/navigator]


# Usage
nav = Navigator(FastestRoute())
nav.route("Home", "Office")  # Route(minutes=12, ...)

nav.set_strategy(ScenicRoute())
nav.route("Home", "Office")  # Route(minutes=35, ...) — same call, different algorithm

nav.set_strategy(ShortestRoute())
nav.route("Home", "Office")  # Route(minutes=18, ...)
