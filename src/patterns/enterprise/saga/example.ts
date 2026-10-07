interface OrderRequest {
  orderId: string;
  sku: string;
  qty: number;
  amount: number;
}

// [inventoryService]
class InventoryService {
  // orderIds currently holding a reservation
  private reserved = new Set<string>();

  reserve(orderId: string, sku: string, qty: number): void {
    // [reserve]
    this.reserved.add(orderId);
    console.log(`inventory: reserved ${qty}x ${sku} for ${orderId}`);
    // [/reserve]
  }

  // [release]
  // Compensating transaction for reserve(): undoes the hold so the stock is
  // available again. Only ever runs if a later saga step fails.
  release(orderId: string): void {
    if (this.reserved.delete(orderId)) {
      console.log(`inventory: released reservation for ${orderId}`);
    }
  }
  // [/release]
}
// [/inventoryService]

// [paymentService]
class PaymentService {
  private charged = new Set<string>();
  // Fault injection for the demo: the next charge() fails, as if the card was declined.
  failNextCharge = false;

  charge(orderId: string, amount: number): void {
    // [charge]
    if (this.failNextCharge) {
      this.failNextCharge = false;
      throw new Error("card declined");
    }
    this.charged.add(orderId);
    console.log(`payment: charged ${amount} for ${orderId}`);
    // [/charge]
  }

  // [refund]
  // Compensating transaction for charge(): only meaningful for an order that
  // was actually charged, which is why the orchestrator only queues it once
  // charge() has succeeded.
  refund(orderId: string): void {
    if (this.charged.delete(orderId)) {
      console.log(`payment: refunded ${orderId}`);
    }
  }
  // [/refund]
}
// [/paymentService]

// [shippingService]
class ShippingService {
  // Fault injection for the demo: the next ship() fails, as if the carrier rejected the package.
  failNextShip = false;

  ship(orderId: string): void {
    // [ship]
    if (this.failNextShip) {
      this.failNextShip = false;
      throw new Error("carrier rejected package");
    }
    console.log(`shipping: shipped ${orderId}`);
    // [/ship]
  }
}
// [/shippingService]

// An "undo step N" closure, queued only once step N has actually succeeded.
type Compensation = () => void;

// [orchestrator]
class OrderSagaOrchestrator {
  constructor(
    private inventory: InventoryService,
    private payments: PaymentService,
    private shipping: ShippingService,
  ) {}

  placeOrder(order: OrderRequest): void {
    const compensations: Compensation[] = [];
    console.log(`saga: starting order ${order.orderId}`);
    try {
      // [runSteps]
      this.inventory.reserve(order.orderId, order.sku, order.qty);
      compensations.push(() => this.inventory.release(order.orderId));

      this.payments.charge(order.orderId, order.amount);
      compensations.push(() => this.payments.refund(order.orderId));

      this.shipping.ship(order.orderId);
      // [/runSteps]
      console.log(`saga: order ${order.orderId} completed`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`saga: step failed (${message}), compensating`);
      // [compensate]
      // Undo only the steps that actually completed, in reverse order: the
      // most recently succeeded step is undone first. A step that never ran
      // has no compensation queued, so it is never touched.
      for (const compensate of compensations.reverse()) {
        compensate();
      }
      // [/compensate]
      console.log(`saga: order ${order.orderId} rolled back`);
    }
  }
}
// [/orchestrator]

// [client]
const inventory = new InventoryService();
const payments = new PaymentService();
const shipping = new ShippingService();
const saga = new OrderSagaOrchestrator(inventory, payments, shipping);

saga.placeOrder({ orderId: "A1", sku: "WIDGET", qty: 2, amount: 50 });
// saga: starting order A1
// inventory: reserved 2x WIDGET for A1
// payment: charged 50 for A1
// shipping: shipped A1
// saga: order A1 completed

payments.failNextCharge = true; // the card is declined this time
saga.placeOrder({ orderId: "A2", sku: "WIDGET", qty: 1, amount: 25 });
// saga: starting order A2
// inventory: reserved 1x WIDGET for A2
// saga: step failed (card declined), compensating
// inventory: released reservation for A2
// saga: order A2 rolled back

shipping.failNextShip = true; // reserve and charge succeed, but the carrier rejects it
saga.placeOrder({ orderId: "A3", sku: "WIDGET", qty: 3, amount: 75 });
// saga: starting order A3
// inventory: reserved 3x WIDGET for A3
// payment: charged 75 for A3
// saga: step failed (carrier rejected package), compensating
// payment: refunded A3
// inventory: released reservation for A3
// saga: order A3 rolled back
// [/client]
