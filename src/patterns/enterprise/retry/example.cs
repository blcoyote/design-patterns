// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [client]
string Describe(Outcome o)
{
    var tail = $"attempts {o.Attempts}, waited {o.WaitedMs}ms";
    if (o.Ok) return $"ok, {tail}";
    if (o.Status >= 500) return $"gave up ({o.Status}), {tail}";
    return $"failed ({o.Status}, not retryable), {tail}";
}

var retrier = new Retrier(
    new RetryPolicy(/* maxAttempts */ 4, /* baseMs */ 100, /* capMs */ 400),
    new ScriptedJitter(new[] { 50, 25, 75, 40, 90, 10 }),
    new FakeSleeper());

void Call(string title, int[] script)
{
    Console.WriteLine($"--- {title} ---");
    var service = new FlakyService(script);
    Console.WriteLine($"result: {Describe(retrier.Execute(service.Get))}");
}

Call("call 1: succeeds on attempt 4", new[] { 503, 503, 503, 200 });
Call("call 2: always fails", new[] { 503 });
Call("call 3: bad request", new[] { 400 });
// [/client]

// [sleeper]
/// <summary>A fake sleeper: Sleep() only adds up the time, nothing really waits.</summary>
class FakeSleeper
{
    public int TotalMs { get; private set; }

    public void Sleep(int ms) => TotalMs += ms;
}
// [/sleeper]

// [jitter]
/// <summary>
/// Scripted jitter, so the output is the same on every run: percentages 0-100 handed out
/// in order and never reset. A real client draws them at random (full jitter is a uniform
/// pick between 0 and the ceiling).
/// </summary>
class ScriptedJitter(int[] percents)
{
    private int _next;

    public int NextPercent() => percents[_next++ % percents.Length];
}
// [/jitter]

// [service]
class ApiException(int status) : Exception($"HTTP {status}")
{
    public int Status { get; } = status;
}

/// <summary>GET /inventory (idempotent). The script lists the status of each call; the last one repeats.</summary>
class FlakyService(int[] script)
{
    private int _calls;

    public string Get()
    {
        var status = script[Math.Min(_calls++, script.Length - 1)];
        if (status >= 400)
        {
            throw new ApiException(status);
        }
        return "inventory: 12 items";
    }
}
// [/service]

// [policy]
record RetryPolicy(int MaxAttempts, int BaseMs, int CapMs)
{
    /// <summary>Exponential backoff: base, 2 x base, 4 x base ..., never above the cap.</summary>
    public int CeilingMs(int attempt) => Math.Min(CapMs, BaseMs * (1 << (attempt - 1)));
}
// [/policy]

record Outcome(bool Ok, int Attempts, int WaitedMs, int Status);

// [retrier]
class Retrier(RetryPolicy policy, ScriptedJitter jitter, FakeSleeper sleeper)
{
    public Outcome Execute(Func<string> fn)
    {
        var sleptBefore = sleeper.TotalMs;
        Outcome Result(bool ok, int attempts, int status) =>
            new(ok, attempts, sleeper.TotalMs - sleptBefore, status);

        for (var attempt = 1; ; attempt++)
        {
            // [attempt]
            try
            {
                fn();
                Console.WriteLine($"attempt {attempt}: ok");
                return Result(true, attempt, 200);
            }
            catch (ApiException err)
            {
                // [classify]
                if (err.Status < 500)
                {
                    Console.WriteLine($"attempt {attempt}: {err.Status} -> not retryable");
                    return Result(false, attempt, err.Status);
                }
                // [/classify]
                // [giveUp]
                if (attempt == policy.MaxAttempts)
                {
                    Console.WriteLine($"attempt {attempt}: {err.Status} -> giving up");
                    return Result(false, attempt, err.Status);
                }
                // [/giveUp]
                // [wait]
                var ceiling = policy.CeilingMs(attempt);
                var delay = ceiling * jitter.NextPercent() / 100;
                Console.WriteLine($"attempt {attempt}: {err.Status} -> retry in {delay}ms (ceiling {ceiling}ms)");
                sleeper.Sleep(delay);
                // [/wait]
            }
            // [/attempt]
        }
    }
}
// [/retrier]
