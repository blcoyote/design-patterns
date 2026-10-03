using System;
using System.Collections.Generic;
using System.Globalization;

// --- Usage: a command through the pipeline, a query through the same one,
// and a second, invalid command to show the pipeline rejecting it ----------

// [usage]
var table = new OrdersTable();

var mediator = new Mediator();
mediator.Use(new LoggingBehaviour());
mediator.Use(new ValidationBehaviour());

var placeOrderHandler = new PlaceOrderHandler(new PlaceOrderStore(table));
var getOrderHandler = new GetOrderHandler(new GetOrderStore(table));

mediator.RegisterHandler("PlaceOrder", request => placeOrderHandler.Handle((PlaceOrderCommand)request));
mediator.RegisterHandler("GetOrder", request => getOrderHandler.Handle((GetOrderQuery)request));

mediator.Send<object>(new PlaceOrderCommand { OrderId = "order-7", CustomerId = "cust-11", TotalCents = 2500 });

var order = mediator.Send<OrderRow>(new GetOrderQuery { OrderId = "order-7" });
Console.WriteLine($"GetOrder result: {order.OrderId} {order.CustomerId} ${(order.TotalCents / 100.0).ToString("F2", CultureInfo.InvariantCulture)}");

// This PlaceOrder has TotalCents: 0. LoggingBehaviour still logs "handling"
// first — it runs before ValidationBehaviour in the pipeline — but
// ValidationBehaviour then throws instead of calling next(), so
// PlaceOrderHandler never runs (no "saved" line) and LoggingBehaviour's
// "handled" line never prints either.
try
{
    mediator.Send<object>(new PlaceOrderCommand { OrderId = "order-8", CustomerId = "cust-12", TotalCents = 0 });
}
catch (ArgumentException ex)
{
    Console.WriteLine($"rejected: {ex.Message}");
}
// [/usage]

// --- Shared pipeline infrastructure --------------------------------------
// Everything in this section is cross-cutting infrastructure: it belongs to
// no single slice, and every slice is routed through the same instance.
// PlaceOrderCommand and GetOrderQuery are declared further down, inside their
// own slice's section — C# resolves types regardless of declaration order
// within a file, so this forward reference is safe.

interface IRequest
{
    string Type { get; }
}

interface IPipelineBehaviour
{
    object? Handle(IRequest request, Func<object?> next);
}

// [mediator]
class Mediator
{
    private readonly Dictionary<string, Func<IRequest, object?>> _handlers = new();
    private readonly List<IPipelineBehaviour> _behaviours = new();

    public void RegisterHandler(string type, Func<IRequest, object?> handler)
    {
        _handlers[type] = handler;
    }

    // Behaviours run in registration order, outermost first: the first behaviour
    // registered wraps everything after it, including every other behaviour.
    public void Use(IPipelineBehaviour behaviour)
    {
        _behaviours.Add(behaviour);
    }

    public TResponse Send<TResponse>(IRequest request)
    {
        if (!_handlers.TryGetValue(request.Type, out var handler))
            throw new InvalidOperationException($"no handler registered for {request.Type}");

        Func<object?> pipeline = () => handler(request);
        for (int i = _behaviours.Count - 1; i >= 0; i--)
        {
            var behaviour = _behaviours[i];
            var next = pipeline;
            pipeline = () => behaviour.Handle(request, next);
        }

        return (TResponse)pipeline()!;
    }
}
// [/mediator]

// [loggingBehaviour]
class LoggingBehaviour : IPipelineBehaviour
{
    public object? Handle(IRequest request, Func<object?> next)
    {
        Console.WriteLine($"LOG: handling {request.Type}");
        // If next() throws (a behaviour further down the chain rejected the
        // request), this line never runs — the exception propagates straight
        // through, and "LOG: handled" never prints.
        var result = next();
        Console.WriteLine($"LOG: handled {request.Type}");
        return result;
    }
}
// [/loggingBehaviour]

// [validationBehaviour]
class ValidationBehaviour : IPipelineBehaviour
{
    public object? Handle(IRequest request, Func<object?> next)
    {
        // A behaviour that does not call next() short-circuits the chain: no
        // behaviour after it, and no handler, ever runs for this request. Note
        // that LoggingBehaviour runs before this one, so it has already logged
        // "handling" by the time a request gets rejected here.
        if (request is PlaceOrderCommand placeOrder && placeOrder.TotalCents <= 0)
            throw new ArgumentException("PlaceOrder requires a positive totalCents");
        if (request is GetOrderQuery getOrder && string.IsNullOrEmpty(getOrder.OrderId))
            throw new ArgumentException("GetOrder requires an orderId");
        return next();
    }
}
// [/validationBehaviour]

// --- Shared table ---------------------------------------------------------
// Vertical slices commonly still share one physical table; what makes each
// slice "self-contained" is that it owns its own narrow data-access code on
// top of that table, not that the bytes are never shared.

record OrderRow(string OrderId, string CustomerId, int TotalCents);

// [ordersTable]
class OrdersTable
{
    private readonly Dictionary<string, OrderRow> _rows = new();

    public void Insert(OrderRow row)
    {
        _rows[row.OrderId] = row;
    }

    public OrderRow? SelectById(string orderId)
    {
        return _rows.TryGetValue(orderId, out var row) ? row : null;
    }
}
// [/ordersTable]

// --- PlaceOrder slice -------------------------------------------------------
// This slice's request type, handler and data access, together. Nothing
// outside this slice needs to know PlaceOrderCommand exists.

// [placeOrderStore]
class PlaceOrderStore
{
    private readonly OrdersTable _table;

    public PlaceOrderStore(OrdersTable table)
    {
        _table = table;
    }

    public void Save(OrderRow row)
    {
        _table.Insert(row);
        Console.WriteLine($"PlaceOrder slice: saved order {row.OrderId}");
    }
}
// [/placeOrderStore]

// [placeOrderHandler]
class PlaceOrderCommand : IRequest
{
    public string Type => "PlaceOrder";
    public required string OrderId { get; init; }
    public required string CustomerId { get; init; }
    public required int TotalCents { get; init; }
}

class PlaceOrderHandler
{
    private readonly PlaceOrderStore _store;

    public PlaceOrderHandler(PlaceOrderStore store)
    {
        _store = store;
    }

    public object Handle(PlaceOrderCommand command)
    {
        _store.Save(new OrderRow(command.OrderId, command.CustomerId, command.TotalCents));
        return new { OrderId = command.OrderId };
    }
}
// [/placeOrderHandler]

// --- GetOrder slice ---------------------------------------------------------
// A completely separate request type, handler and data access — it shares no
// code with the PlaceOrder slice above except the Mediator and the pipeline.

// [getOrderStore]
class GetOrderStore
{
    private readonly OrdersTable _table;

    public GetOrderStore(OrdersTable table)
    {
        _table = table;
    }

    public OrderRow? FindById(string orderId)
    {
        return _table.SelectById(orderId);
    }
}
// [/getOrderStore]

// [getOrderHandler]
class GetOrderQuery : IRequest
{
    public string Type => "GetOrder";
    public required string OrderId { get; init; }
}

class GetOrderHandler
{
    private readonly GetOrderStore _store;

    public GetOrderHandler(GetOrderStore store)
    {
        _store = store;
    }

    public OrderRow Handle(GetOrderQuery query)
    {
        var row = _store.FindById(query.OrderId);
        if (row is null) throw new InvalidOperationException($"no order found for {query.OrderId}");
        return row;
    }
}
// [/getOrderHandler]
