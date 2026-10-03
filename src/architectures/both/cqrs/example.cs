using System;
using System.Collections.Generic;
using System.Globalization;

// --- Usage: command then an immediate query, to surface the lag ---------

// [usage]
var writeStore = new SqlWriteStore();
var readStore = new InMemoryReadStore();
var projector = new Projector(readStore);
var placeOrderHandler = new PlaceOrderHandler(writeStore, projector);
var getOrderSummary = new GetOrderSummaryHandler(readStore);

var dispatcher = new CommandDispatcher();
dispatcher.Register("PlaceOrder", command => placeOrderHandler.Handle((PlaceOrderCommand)command));

dispatcher.Dispatch(new PlaceOrderCommand { OrderId = "order-9", CustomerId = "cust-42", TotalCents = 4998 });
// [/usage]

// [eventualConsistency]
static string FormatView(OrderSummaryView? view) =>
    view is null ? "(none yet)" : $"{view.OrderId} {view.CustomerId} {view.TotalDisplay} {view.Status}";

// Querying immediately after the command returns misses the projection: the
// write succeeded, but nothing has drained the projector's queue yet.
Console.WriteLine($"query right after dispatch: {FormatView(getOrderSummary.Handle("order-9"))}");

projector.CatchUp();

Console.WriteLine($"query after the projector has run: {FormatView(getOrderSummary.Handle("order-9"))}");
// [/eventualConsistency]

// --- Write side -------------------------------------------------------

interface ICommand
{
    string Type { get; }
}

class PlaceOrderCommand : ICommand
{
    public string Type => "PlaceOrder";
    public required string OrderId { get; init; }
    public required string CustomerId { get; init; }
    public required int TotalCents { get; init; }
}

// [aggregate]
class Order
{
    public string Id { get; }
    public string CustomerId { get; }
    public int TotalCents { get; }
    public string Status { get; set; } = "placed";

    public Order(string id, string customerId, int totalCents)
    {
        // Invariant: the write model refuses a command that would create an invalid order.
        if (totalCents <= 0)
            throw new ArgumentException($"order {id}: total must be positive, got {totalCents} cents");
        Id = id;
        CustomerId = customerId;
        TotalCents = totalCents;
    }
}
// [/aggregate]

interface IWriteStore
{
    void Save(Order order);
}

// [writeStore]
class SqlWriteStore : IWriteStore
{
    private readonly Dictionary<string, Order> _rows = new();

    public void Save(Order order)
    {
        _rows[order.Id] = order;
        Console.WriteLine($"WRITE DB: upserted order {order.Id}");
    }
}
// [/writeStore]

// [dispatcher]
class CommandDispatcher
{
    private readonly Dictionary<string, Action<ICommand>> _handlers = new();

    public void Register(string type, Action<ICommand> handler)
    {
        _handlers[type] = handler;
    }

    public void Dispatch(ICommand command)
    {
        if (!_handlers.TryGetValue(command.Type, out var handler))
            throw new InvalidOperationException($"no handler registered for {command.Type}");
        handler(command);
    }
}
// [/dispatcher]

// [commandHandler]
class PlaceOrderHandler
{
    private readonly IWriteStore _writeStore;
    private readonly Projector _projector;

    public PlaceOrderHandler(IWriteStore writeStore, Projector projector)
    {
        _writeStore = writeStore;
        _projector = projector;
    }

    public void Handle(PlaceOrderCommand command)
    {
        var order = new Order(command.OrderId, command.CustomerId, command.TotalCents);
        _writeStore.Save(order);
        // In a real system the projector would pick this up off a queue, a CDC
        // stream or a cron job — asynchronously, on its own schedule. Here that
        // queue is modeled explicitly: enqueuing is instant, but nothing is
        // projected into the read store until something calls projector.CatchUp().
        _projector.Enqueue(order);
    }
}
// [/commandHandler]

// --- Read side ----------------------------------------------------------

record OrderSummaryView(string OrderId, string CustomerId, string TotalDisplay, string Status);

interface IReadStore
{
    void Upsert(OrderSummaryView view);
    OrderSummaryView? Find(string orderId);
}

// [readStore]
class InMemoryReadStore : IReadStore
{
    private readonly Dictionary<string, OrderSummaryView> _views = new();

    public void Upsert(OrderSummaryView view)
    {
        _views[view.OrderId] = view;
    }

    public OrderSummaryView? Find(string orderId)
    {
        return _views.TryGetValue(orderId, out var view) ? view : null;
    }
}
// [/readStore]

// [projector]
class Projector
{
    private readonly IReadStore _readStore;
    private readonly List<Order> _queue = new();

    public Projector(IReadStore readStore)
    {
        _readStore = readStore;
    }

    // Schedules a projection. Stands in for a message landing on a real queue.
    public void Enqueue(Order order)
    {
        _queue.Add(order);
    }

    // Drains the queue, turning each pending write-model change into the
    // denormalised read shape. Calling this is the deterministic stand-in for
    // "enough time has passed for the projector to have run".
    public void CatchUp()
    {
        foreach (var order in _queue)
        {
            var view = new OrderSummaryView(
                order.Id,
                order.CustomerId,
                "$" + (order.TotalCents / 100.0).ToString("F2", CultureInfo.InvariantCulture),
                order.Status);
            _readStore.Upsert(view);
            Console.WriteLine($"READ DB: projected order {view.OrderId}");
        }
        _queue.Clear();
    }
}
// [/projector]

// [queryHandler]
class GetOrderSummaryHandler
{
    private readonly IReadStore _readStore;

    public GetOrderSummaryHandler(IReadStore readStore)
    {
        _readStore = readStore;
    }

    public OrderSummaryView? Handle(string orderId)
    {
        return _readStore.Find(orderId);
    }
}
// [/queryHandler]
