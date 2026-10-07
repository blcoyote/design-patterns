// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var inventory = new InventoryService();
var payments = new PaymentService();
var shipping = new ShippingService();
var saga = new OrderSagaOrchestrator(inventory, payments, shipping);

saga.PlaceOrder(new OrderRequest("A1", "WIDGET", 2, 50));
// saga: starting order A1
// inventory: reserved 2x WIDGET for A1
// payment: charged 50 for A1
// shipping: shipped A1
// saga: order A1 completed

payments.FailNextCharge = true; // the card is declined this time
saga.PlaceOrder(new OrderRequest("A2", "WIDGET", 1, 25));
// saga: starting order A2
// inventory: reserved 1x WIDGET for A2
// saga: step failed (card declined), compensating
// inventory: released reservation for A2
// saga: order A2 rolled back

shipping.FailNextShip = true; // reserve and charge succeed, but the carrier rejects it
saga.PlaceOrder(new OrderRequest("A3", "WIDGET", 3, 75));
// saga: starting order A3
// inventory: reserved 3x WIDGET for A3
// payment: charged 75 for A3
// saga: step failed (carrier rejected package), compensating
// payment: refunded A3
// inventory: released reservation for A3
// saga: order A3 rolled back
// [/client]

record OrderRequest(string OrderId, string Sku, int Qty, int Amount);

// [inventoryService]
class InventoryService
{
    // orderIds currently holding a reservation
    private readonly HashSet<string> _reserved = new();

    public void Reserve(string orderId, string sku, int qty)
    {
        // [reserve]
        _reserved.Add(orderId);
        Console.WriteLine($"inventory: reserved {qty}x {sku} for {orderId}");
        // [/reserve]
    }

    // [release]
    // Compensating transaction for Reserve(): undoes the hold so the stock is
    // available again. Only ever runs if a later saga step fails.
    public void Release(string orderId)
    {
        if (_reserved.Remove(orderId))
        {
            Console.WriteLine($"inventory: released reservation for {orderId}");
        }
    }
    // [/release]
}
// [/inventoryService]

// [paymentService]
class PaymentService
{
    private readonly HashSet<string> _charged = new();

    // Fault injection for the demo: the next Charge() fails, as if the card was declined.
    public bool FailNextCharge { get; set; }

    public void Charge(string orderId, int amount)
    {
        // [charge]
        if (FailNextCharge)
        {
            FailNextCharge = false;
            throw new InvalidOperationException("card declined");
        }
        _charged.Add(orderId);
        Console.WriteLine($"payment: charged {amount} for {orderId}");
        // [/charge]
    }

    // [refund]
    // Compensating transaction for Charge(): only meaningful for an order
    // that was actually charged, which is why the orchestrator only queues it
    // once Charge() has succeeded.
    public void Refund(string orderId)
    {
        if (_charged.Remove(orderId))
        {
            Console.WriteLine($"payment: refunded {orderId}");
        }
    }
    // [/refund]
}
// [/paymentService]

// [shippingService]
class ShippingService
{
    // Fault injection for the demo: the next Ship() fails, as if the carrier rejected the package.
    public bool FailNextShip { get; set; }

    public void Ship(string orderId)
    {
        // [ship]
        if (FailNextShip)
        {
            FailNextShip = false;
            throw new InvalidOperationException("carrier rejected package");
        }
        Console.WriteLine($"shipping: shipped {orderId}");
        // [/ship]
    }
}
// [/shippingService]

// [orchestrator]
class OrderSagaOrchestrator(InventoryService inventory, PaymentService payments, ShippingService shipping)
{
    public void PlaceOrder(OrderRequest order)
    {
        // An "undo step N" closure, queued only once step N has actually succeeded.
        var compensations = new List<Action>();
        Console.WriteLine($"saga: starting order {order.OrderId}");
        try
        {
            // [runSteps]
            inventory.Reserve(order.OrderId, order.Sku, order.Qty);
            compensations.Add(() => inventory.Release(order.OrderId));

            payments.Charge(order.OrderId, order.Amount);
            compensations.Add(() => payments.Refund(order.OrderId));

            shipping.Ship(order.OrderId);
            // [/runSteps]
            Console.WriteLine($"saga: order {order.OrderId} completed");
        }
        catch (Exception e)
        {
            Console.WriteLine($"saga: step failed ({e.Message}), compensating");
            // [compensate]
            // Undo only the steps that actually completed, in reverse order: the
            // most recently succeeded step is undone first. A step that never ran
            // has no compensation queued, so it is never touched.
            compensations.Reverse();
            foreach (var compensate in compensations)
            {
                compensate();
            }
            // [/compensate]
            Console.WriteLine($"saga: order {order.OrderId} rolled back");
        }
    }
}
// [/orchestrator]
