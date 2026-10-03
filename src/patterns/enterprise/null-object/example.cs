#nullable enable
// ============================================================
// Before: "no logger" is represented by null.
// ============================================================
BeforeDemo.Run();

// ============================================================
// After: a Null Object stands in for "no logger".
// ============================================================
// [client]
// Usage
var quiet = new ReportGenerator(); // no logger passed — defaults to NullLogger
quiet.Generate(new ReportData(new List<object> { 1, 2, 3 })); // runs to completion: no guard, no crash, no noise

var verbose = new ReportGenerator(new ConsoleLogger());
verbose.Generate(new ReportData(new List<object> { 1, 2, 3 })); // the exact same Generate() — now it actually logs
// [/client]

class ReportData(List<object> rows)
{
    public List<object> Rows { get; } = rows;
}

class Report(List<string> warnings)
{
    public List<string> Warnings { get; } = warnings;
}

static class ReportBuilder
{
    public static Report Build(ReportData data) =>
        new(data.Rows.Count > 2 ? new List<string> { "low confidence" } : new List<string>());
}

// [before]
// Shared types used by both versions below.
static class BeforeDemo
{
    public static void Run()
    {
        var cleanData = new ReportData(new List<object> { 1, 2 });
        var dataWithWarnings = new ReportData(new List<object> { 1, 2, 3 });

        // Fine on the happy path — the guarded calls just no-op:
        new ReportGeneratorBefore(null).Generate(cleanData);

        // Crashes the moment a report has warnings:
        try
        {
            new ReportGeneratorBefore(null).Generate(dataWithWarnings);
        }
        catch (NullReferenceException ex)
        {
            Console.WriteLine($"crashed: {ex.Message}");
        }
    }
}

class ReportGeneratorBefore(ILogger? logger)
{
    public Report Generate(ReportData data)
    {
        // [guard]
        if (logger != null) logger.Info("starting report");
        var result = ReportBuilder.Build(data);
        if (logger != null) logger.Info("report ready");
        // [/guard]

        // [forgotten]
        if (result.Warnings.Count > 0)
        {
            // forgot the null check every other call site remembered. With nullable
            // reference types this is only a compiler warning (CS8602), not an error,
            // so it is easy to miss — and it still throws a NullReferenceException at
            // runtime, exactly the clutter Null Object removes.
            logger.Warn($"report has {result.Warnings.Count} warnings");
        }
        // [/forgotten]

        return result;
    }
}
// [/before]

// [logger]
interface ILogger
{
    void Info(string msg);
    void Warn(string msg);
    void Error(string msg);
}
// [/logger]

// [nullLogger]
class NullLogger : ILogger
{
    public void Info(string msg) { }
    public void Warn(string msg) { }
    public void Error(string msg) { }
}
// [/nullLogger]

// [consoleLogger]
class ConsoleLogger : ILogger
{
    public void Info(string msg) => Console.WriteLine(msg);
    public void Warn(string msg) => Console.WriteLine(msg);
    public void Error(string msg) => Console.WriteLine(msg);
}
// [/consoleLogger]

// [reportGenerator]
class ReportGenerator
{
    // [holds]
    private readonly ILogger _logger;
    public ReportGenerator(ILogger? logger = null)
    {
        _logger = logger ?? new NullLogger();
    }
    // [/holds]

    // [generate]
    public Report Generate(ReportData data)
    {
        _logger.Info("starting report");
        var result = ReportBuilder.Build(data);
        _logger.Info("report ready");
        if (result.Warnings.Count > 0)
        {
            _logger.Warn($"report has {result.Warnings.Count} warnings");
        }
        return result;
    }
    // [/generate]
}
// [/reportGenerator]
