// In production C# you'd often reach for the built-in event/EventHandler<T>
// or IObservable<T>/IObserver<T> instead of hand-rolling this, but we keep
// the explicit pattern structure here for clarity.

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
var ticker = new StockTicker();
var alert = new PriceAlert(100);
ticker.Subscribe(new PriceChart());
ticker.Subscribe(alert);
ticker.Subscribe(new AuditLog());

ticker.SetPrice(101.5m); // all three react
ticker.Unsubscribe(alert);
ticker.SetPrice(99m); // only chart + log

// [observer]
interface IPriceObserver
{
    void Update(decimal price);
}
// [/observer]

// [subject]
class StockTicker
{
    private readonly List<IPriceObserver> _observers = new();
    private decimal _price;

    // [subscribe]
    public void Subscribe(IPriceObserver observer)
    {
        _observers.Add(observer);
    }
    // [/subscribe]

    // [unsubscribe]
    public void Unsubscribe(IPriceObserver observer)
    {
        _observers.RemoveAll(o => o == observer);
    }
    // [/unsubscribe]

    // [setPrice]
    public void SetPrice(decimal price)
    {
        _price = price;
        Notify();
    }
    // [/setPrice]

    // [notify]
    private void Notify()
    {
        // ToArray() snapshots the list so an observer that unsubscribes
        // itself during notification doesn't mutate the collection we're
        // iterating over.
        foreach (var observer in _observers.ToArray()) observer.Update(_price);
    }
    // [/notify]
}
// [/subject]

// [concrete]
// [chart]
class PriceChart : IPriceObserver
{
    public void Update(decimal price)
    {
        Console.WriteLine(FormattableString.Invariant($"chart: plot {price}"));
    }
}
// [/chart]

// [alert]
class PriceAlert(decimal limit) : IPriceObserver
{
    public void Update(decimal price)
    {
        if (price > limit) Console.WriteLine($"warning: price above {limit}!");
    }
}
// [/alert]

// [logger]
class AuditLog : IPriceObserver
{
    public List<decimal> Entries { get; } = new();

    public void Update(decimal price)
    {
        Entries.Add(price);
    }
}
// [/logger]
// [/concrete]
