// [domainModel]
type ShipmentStatus = "Pending" | "InTransit" | "Delivered" | "Unknown";

interface Shipment {
  orderId: string;
  status: ShipmentStatus;
  estimatedDelivery: Date | null;
}
// [/domainModel]

// [legacySystem]
interface LegacyShipmentRecord {
  trk: string;
  stat: number; // 0 pending, 1 in transit, 2 delivered — anything else is an unmapped legacy code
  eta: string; // "MM/DD/YYYY", sometimes empty or malformed
}

class LegacyShippingSystem {
  // [lookup]
  lookup(orderId: string): LegacyShipmentRecord {
    if (orderId === "O-1001") {
      return { trk: orderId, stat: 1, eta: "04/02/2025" };
    }
    // O-2002: a corrupt record from the legacy system — an unmapped status code and an impossible date
    return { trk: orderId, stat: 9, eta: "02/30/2025" };
  }
  // [/lookup]
}
// [/legacySystem]

// [acl]
class ShippingAntiCorruptionLayer {
  constructor(private legacy: LegacyShippingSystem) {}

  // [translate]
  getShipment(orderId: string): Shipment {
    const record = this.legacy.lookup(orderId);
    return {
      orderId,
      status: this.translateStatus(record.stat),
      estimatedDelivery: this.parseEta(record.eta),
    };
  }

  private translateStatus(stat: number): ShipmentStatus {
    switch (stat) {
      case 0:
        return "Pending";
      case 1:
        return "InTransit";
      case 2:
        return "Delivered";
      default:
        // An unmapped legacy code never reaches the domain as a raw number.
        return "Unknown";
    }
  }

  private parseEta(eta: string): Date | null {
    const parts = eta.split("/");
    if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
    const [month, day, year] = parts.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC silently rolls an invalid day/month over into the next one (Feb 30 becomes Mar 2)
    // instead of rejecting it, so round-trip the components to catch that instead of returning
    // a shifted date. A malformed legacy date never reaches the domain either way.
    const isValidCalendarDate =
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day;
    return isValidCalendarDate ? date : null;
  }
  // [/translate]
}
// [/acl]

// [trackingService]
class OrderTrackingService {
  constructor(private acl: ShippingAntiCorruptionLayer) {}

  describe(orderId: string): string {
    const shipment = this.acl.getShipment(orderId);
    const eta = shipment.estimatedDelivery
      ? shipment.estimatedDelivery.toISOString().slice(0, 10)
      : "unknown";
    return `${shipment.orderId}: ${shipment.status}, ETA ${eta}`;
  }
}
// [/trackingService]

// [usage]
// Usage
const trackingService = new OrderTrackingService(
  new ShippingAntiCorruptionLayer(new LegacyShippingSystem()),
);
console.log(trackingService.describe("O-1001"));
console.log(trackingService.describe("O-2002"));
// [/usage]
