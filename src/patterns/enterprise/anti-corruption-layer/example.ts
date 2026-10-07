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
    // O-2002: a corrupt record from the legacy system — an unmapped status code and a blank date
    return { trk: orderId, stat: 9, eta: "" };
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
    const [month, day, year] = eta.split("/").map(Number);
    if (!month || !day || !year) return null; // a malformed legacy date never reaches the domain either
    return new Date(Date.UTC(year, month - 1, day)); // UTC keeps the ISO string timezone-independent
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
