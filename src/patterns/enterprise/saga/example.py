from dataclasses import dataclass
from typing import Callable


@dataclass
class OrderRequest:
    order_id: str
    sku: str
    qty: int
    amount: int


# [inventoryService]
class InventoryService:
    def __init__(self) -> None:
        # orderIds currently holding a reservation
        self._reserved: set[str] = set()

    def reserve(self, order_id: str, sku: str, qty: int) -> None:
        # [reserve]
        self._reserved.add(order_id)
        print(f"inventory: reserved {qty}x {sku} for {order_id}")
        # [/reserve]

    # [release]
    # Compensating transaction for reserve(): undoes the hold so the stock is
    # available again. Only ever runs if a later saga step fails.
    def release(self, order_id: str) -> None:
        if order_id in self._reserved:
            self._reserved.discard(order_id)
            print(f"inventory: released reservation for {order_id}")
    # [/release]
# [/inventoryService]


# [paymentService]
class PaymentService:
    def __init__(self) -> None:
        self._charged: set[str] = set()
        # Fault injection for the demo: the next charge() fails, as if the card was declined.
        self.fail_next_charge = False

    def charge(self, order_id: str, amount: int) -> None:
        # [charge]
        if self.fail_next_charge:
            self.fail_next_charge = False
            raise RuntimeError("card declined")
        self._charged.add(order_id)
        print(f"payment: charged {amount} for {order_id}")
        # [/charge]

    # [refund]
    # Compensating transaction for charge(): only meaningful for an order
    # that was actually charged, which is why the orchestrator only queues it
    # once charge() has succeeded.
    def refund(self, order_id: str) -> None:
        if order_id in self._charged:
            self._charged.discard(order_id)
            print(f"payment: refunded {order_id}")
    # [/refund]
# [/paymentService]


# [shippingService]
class ShippingService:
    def __init__(self) -> None:
        # Fault injection for the demo: the next ship() fails, as if the carrier rejected the package.
        self.fail_next_ship = False

    def ship(self, order_id: str) -> None:
        # [ship]
        if self.fail_next_ship:
            self.fail_next_ship = False
            raise RuntimeError("carrier rejected package")
        print(f"shipping: shipped {order_id}")
        # [/ship]
# [/shippingService]


# An "undo step N" closure, queued only once step N has actually succeeded.
Compensation = Callable[[], None]


# [orchestrator]
class OrderSagaOrchestrator:
    def __init__(
        self, inventory: InventoryService, payments: PaymentService, shipping: ShippingService
    ) -> None:
        self._inventory = inventory
        self._payments = payments
        self._shipping = shipping

    def place_order(self, order: OrderRequest) -> None:
        compensations: list[Compensation] = []
        print(f"saga: starting order {order.order_id}")
        try:
            # [runSteps]
            self._inventory.reserve(order.order_id, order.sku, order.qty)
            compensations.append(lambda: self._inventory.release(order.order_id))

            self._payments.charge(order.order_id, order.amount)
            compensations.append(lambda: self._payments.refund(order.order_id))

            self._shipping.ship(order.order_id)
            # [/runSteps]
            print(f"saga: order {order.order_id} completed")
        except Exception as e:
            print(f"saga: step failed ({e}), compensating")
            # [compensate]
            # Undo only the steps that actually completed, in reverse order: the
            # most recently succeeded step is undone first. A step that never ran
            # has no compensation queued, so it is never touched.
            for compensate in reversed(compensations):
                compensate()
            # [/compensate]
            print(f"saga: order {order.order_id} rolled back")
# [/orchestrator]


# [client]
inventory = InventoryService()
payments = PaymentService()
shipping = ShippingService()
saga = OrderSagaOrchestrator(inventory, payments, shipping)

saga.place_order(OrderRequest("A1", "WIDGET", 2, 50))
# saga: starting order A1
# inventory: reserved 2x WIDGET for A1
# payment: charged 50 for A1
# shipping: shipped A1
# saga: order A1 completed

payments.fail_next_charge = True  # the card is declined this time
saga.place_order(OrderRequest("A2", "WIDGET", 1, 25))
# saga: starting order A2
# inventory: reserved 1x WIDGET for A2
# saga: step failed (card declined), compensating
# inventory: released reservation for A2
# saga: order A2 rolled back

shipping.fail_next_ship = True  # reserve and charge succeed, but the carrier rejects it
saga.place_order(OrderRequest("A3", "WIDGET", 3, 75))
# saga: starting order A3
# inventory: reserved 3x WIDGET for A3
# payment: charged 75 for A3
# saga: step failed (carrier rejected package), compensating
# payment: refunded A3
# inventory: released reservation for A3
# saga: order A3 rolled back
# [/client]
