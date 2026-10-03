// In production C# you'd often reach for Polly's circuit-breaker / resilience
// pipelines instead of hand-rolling this, but we keep the explicit pattern
// structure here for clarity.

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
const int CooldownMs = 4000;
var clock = new Clock();
var service = new RemoteService();
var breaker = new CircuitBreaker(clock, /* failureThreshold */ 3, CooldownMs);

async Task Attempt(string label)
{
    BreakerState? ranWhile = null;
    string outcome;
    try
    {
        outcome = await breaker.CallAsync(() =>
        {
            ranWhile = breaker.State; // only set if the breaker actually lets fn() run
            return service.RequestAsync();
        });
    }
    catch (InvalidOperationException ex)
    {
        outcome = ex.Message;
    }
    var ran = ranWhile is { } state ? $"fn ran while {CircuitBreaker.Name(state)}" : "fn never ran";
    Console.WriteLine($"{label}: {outcome} ({ran}) -> {breaker.Status}, service calls: {service.Calls}");
}

await Attempt("call 1"); // ok (fn ran while CLOSED) -> CLOSED, failures: 0/3, service calls: 1
service.Healthy = false;
await Attempt("call 2"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 2
await Attempt("call 3"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 3
await Attempt("call 4"); // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 4
await Attempt("call 5"); // circuit open, failing fast (fn never ran) -> OPEN, failures: 3/3, service calls: 4

clock.Advance(CooldownMs);
service.Healthy = true;
// Nothing has changed yet: Open only notices the elapsed cooldown on the next call.
Console.WriteLine($"cooldown elapsed -> {breaker.Status}"); // OPEN, failures: 3/3
await Attempt("call 6"); // ok (fn ran while HALF_OPEN) -> CLOSED, failures: 0/3, service calls: 5

// Later: a fresh failure streak trips it again, and this time the trial fails too.
service.Healthy = false;
await Attempt("call 7"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 1/3, service calls: 6
await Attempt("call 8"); // service unavailable (fn ran while CLOSED) -> CLOSED, failures: 2/3, service calls: 7
await Attempt("call 9"); // service unavailable (fn ran while CLOSED) -> OPEN, failures: 3/3, service calls: 8
clock.Advance(CooldownMs);
await Attempt("call 10"); // service unavailable (fn ran while HALF_OPEN) -> OPEN, failures: 3/3, service calls: 9
// [/client]

// [clock]
/** A fake clock: time only moves when the usage code calls Advance(). No real time anywhere. */
class Clock
{
    public long NowMs { get; private set; }

    public void Advance(long ms) => NowMs += ms;
}
// [/clock]

// [service]
/** A downstream dependency that can start failing under load. */
class RemoteService
{
    public bool Healthy { get; set; } = true; // flipped by the usage code to simulate an outage and a recovery
    public int Calls { get; private set; }

    public Task<string> RequestAsync()
    {
        Calls++;
        if (!Healthy)
        {
            throw new InvalidOperationException("service unavailable");
        }
        return Task.FromResult("ok");
    }
}
// [/service]

enum BreakerState { Closed, Open, HalfOpen }

// [breaker]
// The lock guards the breaker's state because async continuations can resume on
// different thread-pool threads. It is never held across an await, so a slow
// call blocks nobody.
class CircuitBreaker(Clock clock, int failureThreshold, int cooldownMs)
{
    private readonly object _gate = new();
    private BreakerState _state = BreakerState.Closed;
    private int _failureCount;
    private long _nextAttempt;
    private bool _trialInFlight;
    // Bumped whenever the breaker opens or enters Half-Open, so a slow call that
    // started in an earlier state can't drive a transition it never observed.
    private int _generation;

    /** Read-only views for the usage printout. */
    public BreakerState State
    {
        get { lock (_gate) return _state; }
    }

    public string Status
    {
        get { lock (_gate) return $"{Name(_state)}, failures: {_failureCount}/{failureThreshold}"; }
    }

    public static string Name(BreakerState state) => state switch
    {
        BreakerState.Closed => "CLOSED",
        BreakerState.Open => "OPEN",
        _ => "HALF_OPEN",
    };

    // [call]
    public async Task<T> CallAsync<T>(Func<Task<T>> fn)
    {
        bool isTrial;
        int callGeneration;
        lock (_gate)
        {
            // [openCheck]
            if (_state == BreakerState.Open)
            {
                if (clock.NowMs < _nextAttempt)
                {
                    throw new InvalidOperationException("circuit open, failing fast"); // fn() never runs
                }
                // [halfOpenCheck]
                _state = BreakerState.HalfOpen; // cooldown elapsed: let exactly one trial through
                _generation++;
                // [/halfOpenCheck]
            }
            // Only one probe at a time: while it is in flight, everyone else keeps failing fast.
            if (_state == BreakerState.HalfOpen && _trialInFlight)
            {
                throw new InvalidOperationException("circuit half-open, trial in progress");
            }
            // [/openCheck]

            isTrial = _state == BreakerState.HalfOpen;
            callGeneration = _generation; // only *this* call's own outcome may move that generation on
            if (isTrial) _trialInFlight = true;
        }
        try
        {
            // [invoke]
            var result = await fn();
            // [/invoke]
            lock (_gate)
            {
                // [onSuccess]
                if (callGeneration == _generation)
                {
                    _failureCount = 0;
                    _state = BreakerState.Closed;
                }
                // [/onSuccess]
            }
            return result;
        }
        catch
        {
            lock (_gate)
            {
                // [onFailure]
                if (callGeneration == _generation)
                {
                    if (_state == BreakerState.HalfOpen)
                    {
                        Trip(); // the trial failed: straight back to Open
                    }
                    else if (++_failureCount >= failureThreshold)
                    {
                        Trip();
                    }
                }
                // [/onFailure]
            }
            throw;
        }
        finally
        {
            if (isTrial)
            {
                lock (_gate) _trialInFlight = false;
            }
        }
    }
    // [/call]

    // Called only while holding _gate.
    private void Trip()
    {
        _state = BreakerState.Open;
        _nextAttempt = clock.NowMs + cooldownMs;
        _generation++;
    }
}
// [/breaker]
