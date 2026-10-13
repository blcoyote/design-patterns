// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var shared = Scenarios.RunShared();
var (paymentsBulkhead, recsBulkhead) = Scenarios.RunIsolated();
Console.WriteLine(FormattableString.Invariant(
    $"rejected: shared {shared.Rejected}, payments {paymentsBulkhead.Rejected}, recommendations {recsBulkhead.Rejected}"));
// [/usage]

// [bulkhead]
// A fixed number of concurrent-call slots, used by one dependency or shared by several.
class Bulkhead(string name, int maxConcurrent)
{
    public string Name { get; } = name;
    public int MaxConcurrent { get; } = maxConcurrent;
    public int InFlight { get; private set; }
    public int Rejected { get; private set; }

    // There is no waiting queue: a full bulkhead rejects at once. Real ones often
    // allow a short wait or a bounded queue before rejecting.
    public bool TryAcquire()
    {
        if (InFlight >= MaxConcurrent)
        {
            Rejected++; // a rejected call never takes a slot
            return false;
        }
        InFlight++;
        return true;
    }

    public void Release()
    {
        if (InFlight == 0)
        {
            throw new InvalidOperationException($"{Name}: release without a matching acquire");
        }
        InFlight--;
    }
}
// [/bulkhead]

// [dependency]
// Concurrency is simulated: a started call stays in flight until the calling code
// finishes it, which stands in for a slow response. There are no threads, timers or
// awaits. Real calls finish on their own on many threads, so a real limiter must be
// thread-safe (atomic counters or a semaphore).
class Dependency(string name, Bulkhead bulkhead)
{
    private readonly List<string> _inFlightIds = [];

    public string Name { get; } = name;

    public bool Start(string callId)
    {
        if (!bulkhead.TryAcquire())
        {
            Console.WriteLine(FormattableString.Invariant(
                $"[{Name}] {callId} rejected: {bulkhead.Name} is full ({bulkhead.InFlight}/{bulkhead.MaxConcurrent})"));
            return false;
        }
        _inFlightIds.Add(callId);
        Console.WriteLine(FormattableString.Invariant(
            $"[{Name}] {callId} started ({bulkhead.Name} {bulkhead.InFlight}/{bulkhead.MaxConcurrent})"));
        return true;
    }

    public void Finish(string callId)
    {
        var index = _inFlightIds.IndexOf(callId);
        if (index == -1)
        {
            throw new InvalidOperationException($"{Name}: {callId} is not in flight");
        }
        _inFlightIds.RemoveAt(index); // removes the first match only
        bulkhead.Release();
        Console.WriteLine(FormattableString.Invariant(
            $"[{Name}] {callId} finished ({bulkhead.Name} {bulkhead.InFlight}/{bulkhead.MaxConcurrent})"));
    }
}
// [/dependency]

static class Scenarios
{
    // [shared]
    public static Bulkhead RunShared()
    {
        Console.WriteLine("--- shared pool (no bulkhead), limit 4 ---");
        var shared = new Bulkhead("shared", 4);
        var payments = new Dependency("payments", shared);
        var recommendations = new Dependency("recommendations", shared);

        // Recommendations is slow: its calls stay in flight.
        recommendations.Start("r1");
        recommendations.Start("r2");
        recommendations.Start("r3");
        recommendations.Start("r4");

        // One slow dependency used up the slots that payments needed.
        payments.Start("p1"); // rejected
        return shared;
    }
    // [/shared]

    // [isolated]
    public static (Bulkhead Payments, Bulkhead Recommendations) RunIsolated()
    {
        Console.WriteLine("--- one bulkhead per dependency, 2 slots each ---");
        var paymentsBulkhead = new Bulkhead("payments", 2);
        var recsBulkhead = new Bulkhead("recommendations", 2);
        var payments = new Dependency("payments", paymentsBulkhead);
        var recommendations = new Dependency("recommendations", recsBulkhead);

        recommendations.Start("r1");
        recommendations.Start("r2");
        recommendations.Start("r3"); // rejected: only recommendations is full

        payments.Start("p1"); // unaffected by the slow dependency
        payments.Finish("p1");

        recommendations.Finish("r1"); // frees a slot...
        recommendations.Start("r4"); // ...which the next call reuses
        return (paymentsBulkhead, recsBulkhead);
    }
    // [/isolated]
}
