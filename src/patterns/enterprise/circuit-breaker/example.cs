// In production C# you'd often reach for Polly's circuit-breaker / resilience
// pipelines instead of hand-rolling this, but we keep the explicit pattern
// structure here for clarity.

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
var serviceIsHealthy = true;
var service = new RemoteService(() => serviceIsHealthy);
var breaker = new CircuitBreaker(/* failureThreshold */ 3, /* cooldownMs */ 4000);

await breaker.CallAsync(() => service.RequestAsync());
// [/client]

// [service]
/** A downstream dependency that can start failing under load. */
class RemoteService(Func<bool> isHealthy)
{
    public Task<string> RequestAsync()
    {
        if (!isHealthy())
        {
            throw new InvalidOperationException("service unavailable");
        }
        return Task.FromResult("ok");
    }
}
// [/service]

enum BreakerState { Closed, Open, HalfOpen }

// [breaker]
class CircuitBreaker(int failureThreshold, int cooldownMs)
{
    private BreakerState _state = BreakerState.Closed;
    private int _failureCount;
    private long _nextAttempt;
    private bool _trialInFlight;
    // Bumped on every state transition, so a slow call that started in an
    // earlier state can't drive a transition it never actually observed.
    private int _generation;

    // [call]
    public async Task<T> CallAsync<T>(Func<Task<T>> fn)
    {
        // [openCheck]
        if (_state == BreakerState.Open)
        {
            if (Environment.TickCount64 < _nextAttempt)
            {
                throw new InvalidOperationException("circuit open — failing fast"); // fn() never runs
            }
            // [halfOpenCheck]
            _state = BreakerState.HalfOpen; // cooldown elapsed: let exactly one trial through
            _generation++;
            // [/halfOpenCheck]
        }
        // Only one probe at a time: while it is in flight, everyone else keeps failing fast.
        if (_state == BreakerState.HalfOpen && _trialInFlight)
        {
            throw new InvalidOperationException("circuit half-open — trial in progress");
        }
        // [/openCheck]

        var isTrial = _state == BreakerState.HalfOpen;
        var callGeneration = _generation; // only *this* call's own outcome may move that generation on
        if (isTrial) _trialInFlight = true;
        try
        {
            // [invoke]
            var result = await fn();
            // [/invoke]
            // [onSuccess]
            if (callGeneration == _generation)
            {
                _failureCount = 0;
                _state = BreakerState.Closed;
            }
            // [/onSuccess]
            return result;
        }
        catch
        {
            // [onFailure]
            if (callGeneration == _generation)
            {
                _failureCount++;
                if (_state == BreakerState.HalfOpen || _failureCount >= failureThreshold)
                {
                    _state = BreakerState.Open;
                    _nextAttempt = Environment.TickCount64 + cooldownMs;
                    _generation++;
                }
            }
            // [/onFailure]
            throw;
        }
        finally
        {
            if (isTrial) _trialInFlight = false;
        }
    }
    // [/call]
}
// [/breaker]
