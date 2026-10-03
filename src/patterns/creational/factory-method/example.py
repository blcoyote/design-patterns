from abc import ABC, abstractmethod
from typing import Protocol


# [transport]
class Transport(Protocol):
    def deliver(self) -> str: ...
# [/transport]


# [truck]
class Truck:
    def deliver(self) -> str:
        return "Delivering by road in a truck"
# [/truck]


# [ship]
class Ship:
    def deliver(self) -> str:
        return "Delivering by sea in a ship"
# [/ship]


# [logistics]
class Logistics(ABC):
    # The factory method — subclasses decide what this returns.
    @abstractmethod
    def create_transport(self) -> Transport: ...

    # Shared logic that relies on create_transport() without knowing the concrete type.
    def plan_delivery(self) -> str:
        transport = self.create_transport()
        return f"Planned. {transport.deliver()}"
# [/logistics]


# [roadLogistics]
class RoadLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Truck()
# [/roadLogistics]


# [seaLogistics]
class SeaLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Ship()
# [/seaLogistics]


# Usage
# [usage]
def run_delivery(logistics: Logistics) -> None:
    print(logistics.plan_delivery())


run_delivery(RoadLogistics())  # "Planned. Delivering by road in a truck"
run_delivery(SeaLogistics())  # "Planned. Delivering by sea in a ship"
# [/usage]
