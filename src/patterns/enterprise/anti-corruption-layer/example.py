from dataclasses import dataclass
from datetime import date
from enum import Enum


# [domainModel]
class ShipmentStatus(Enum):
    PENDING = 'Pending'
    IN_TRANSIT = 'InTransit'
    DELIVERED = 'Delivered'
    UNKNOWN = 'Unknown'


@dataclass
class Shipment:
    order_id: str
    status: ShipmentStatus
    estimated_delivery: date | None
# [/domainModel]


# [legacySystem]
@dataclass
class LegacyShipmentRecord:
    trk: str
    stat: int  # 0 pending, 1 in transit, 2 delivered — anything else is an unmapped legacy code
    eta: str  # "MM/DD/YYYY", sometimes empty or malformed


class LegacyShippingSystem:
    # [lookup]
    def lookup(self, order_id: str) -> LegacyShipmentRecord:
        if order_id == 'O-1001':
            return LegacyShipmentRecord(trk=order_id, stat=1, eta='04/02/2025')
        # O-2002: a corrupt record from the legacy system — an unmapped status code and an impossible date
        return LegacyShipmentRecord(trk=order_id, stat=9, eta='02/30/2025')
    # [/lookup]
# [/legacySystem]


# [acl]
class ShippingAntiCorruptionLayer:
    def __init__(self, legacy: LegacyShippingSystem) -> None:
        self._legacy = legacy

    # [translate]
    def get_shipment(self, order_id: str) -> Shipment:
        record = self._legacy.lookup(order_id)
        return Shipment(
            order_id=order_id,
            status=self._translate_status(record.stat),
            estimated_delivery=self._parse_eta(record.eta),
        )

    @staticmethod
    def _translate_status(stat: int) -> ShipmentStatus:
        return {
            0: ShipmentStatus.PENDING,
            1: ShipmentStatus.IN_TRANSIT,
            2: ShipmentStatus.DELIVERED,
        }.get(stat, ShipmentStatus.UNKNOWN)  # an unmapped legacy code never reaches the domain as a raw number

    @staticmethod
    def _parse_eta(eta: str) -> date | None:
        parts = eta.split('/')
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            return None  # a malformed legacy date never reaches the domain either
        month, day, year = (int(p) for p in parts)
        try:
            return date(year, month, day)
        except ValueError:
            # date() rejects an impossible calendar date (Feb 30, month 13, ...) by raising;
            # catch it here so it never reaches the domain as a crash.
            return None
    # [/translate]
# [/acl]


# [trackingService]
class OrderTrackingService:
    def __init__(self, acl: ShippingAntiCorruptionLayer) -> None:
        self._acl = acl

    def describe(self, order_id: str) -> str:
        shipment = self._acl.get_shipment(order_id)
        eta = shipment.estimated_delivery.isoformat() if shipment.estimated_delivery else 'unknown'
        return f'{shipment.order_id}: {shipment.status.value}, ETA {eta}'
# [/trackingService]


# [usage]
# Usage
tracking_service = OrderTrackingService(ShippingAntiCorruptionLayer(LegacyShippingSystem()))
print(tracking_service.describe('O-1001'))
print(tracking_service.describe('O-2002'))
# [/usage]
