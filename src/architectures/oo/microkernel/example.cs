using System;
using System.Collections.Generic;
using System.Globalization;

// [usage]
string Describe(ClaimDecision decision) =>
    decision.Status == "approved"
        ? $"{decision.ClaimId}: approved, payout {Money.FormatCents(decision.PayoutCents)}"
        : $"{decision.ClaimId}: manual review, {decision.Reason}";

var core = new ClaimsCore();
core.Install(new CaRulesPlugin());
core.Install(new NyRulesPlugin());
core.Install(new AuditLogPlugin());
core.Install(new LegacyTxPlugin()); // rejected: needs API 1, the core provides 2

Console.WriteLine(Describe(core.Process(new Claim("claim-1", "CA", 150000))));
Console.WriteLine(Describe(core.Process(new Claim("claim-2", "NY", 350000))));
// No TX rules are installed, and the core keeps working: a manual review, not a failure.
Console.WriteLine(Describe(core.Process(new Claim("claim-3", "TX", 80000))));

// A plug-in installed later: ClaimsCore is untouched.
core.Install(new TxRulesPlugin());
Console.WriteLine(Describe(core.Process(new Claim("claim-3", "TX", 80000))));
// [/usage]

// [contracts]
/// <summary>
/// Everything a plug-in may see: the contract. Plug-ins are written against these types and
/// nothing else. The core's own class, its registry and its internals are not part of it.
/// </summary>

static class Contract
{
    /// The version of the plug-in contract this core provides. A plug-in built for another version is refused.
    public const int CoreApiVersion = 2;
}

/// Money is integer cents everywhere.
record Claim(string Id, string Region, long AmountCents);

/// PayoutCents is 0 for a manual review; Reason is the empty string when approved.
record ClaimDecision(string ClaimId, string Region, string Status, long PayoutCents, string Reason);

/// An extension point: how one region turns a claim into a payout.
interface IClaimRules
{
    /// Returns the payout in cents.
    long Assess(Claim claim);
}

/// A second extension point: called with every decision the core makes.
delegate void ClaimListener(ClaimDecision decision);

/// The core services a plug-in receives while it is being activated.
interface ICoreApi
{
    void RegisterClaimRules(string region, IClaimRules rules);
    void AddClaimListener(ClaimListener listener);
    void Log(string message);
}

interface IPlugin
{
    string Id { get; }

    /// The contract version this plug-in was built against.
    int ApiVersion { get; }

    void Activate(ICoreApi core);
}

/// Money is integer cents everywhere. Formats 55000 as "550.00" with integer arithmetic only (no floats, no thousands separator).
static class Money
{
    public static string FormatCents(long cents)
    {
        long whole = cents / 100;
        long fraction = cents % 100;
        return $"{whole.ToString(CultureInfo.InvariantCulture)}.{fraction.ToString("D2", CultureInfo.InvariantCulture)}";
    }
}
// [/contracts]

// [core]
/// <summary>
/// The core system. It has its own job (processing claims) and nothing region-specific: all
/// of that arrives through plug-ins. It never names a plug-in class; it only knows the IPlugin
/// contract. In this one-file demo the composition (which plug-ins to install) happens in usage.
/// </summary>
class ClaimsCore
{
    // The registry: one extension point keyed by region, one ordered list of listeners.
    private readonly Dictionary<string, IClaimRules> _rulesByRegion = new();
    private readonly List<ClaimListener> _listeners = new();

    /// <summary>
    /// Installs a plug-in. Returns false when the contract version does not match: that is a
    /// printed line and a false result, not an exception, and Activate is never called.
    /// </summary>
    public bool Install(IPlugin plugin)
    {
        if (plugin.ApiVersion != Contract.CoreApiVersion)
        {
            Console.WriteLine(
                $"[core] rejected {plugin.Id}: needs core API {plugin.ApiVersion}, core provides {Contract.CoreApiVersion}");
            return false;
        }

        // Each plug-in gets its own ICoreApi, so the core can record what that plug-in contributed
        // and tag its log lines with the plug-in id.
        var contributions = new List<string>();
        var api = new PluginApi(this, plugin.Id, contributions);

        plugin.Activate(api);
        Console.WriteLine($"[core] loaded {plugin.Id} ({string.Join(", ", contributions)})");
        return true;
    }

    public ClaimDecision Process(Claim claim)
    {
        var decision = _rulesByRegion.TryGetValue(claim.Region, out var rules)
            ? new ClaimDecision(claim.Id, claim.Region, "approved", rules.Assess(claim), "")
            : new ClaimDecision(claim.Id, claim.Region, "manual review", 0, $"no rules for {claim.Region}");

        // Iterate a snapshot: a listener added during notification first hears the next decision.
        foreach (var listener in _listeners.ToArray()) listener(decision);
        return decision;
    }

    /// The per-plug-in view of the core: a private nested class, so no plug-in can name it.
    private sealed class PluginApi : ICoreApi
    {
        private readonly ClaimsCore _core;
        private readonly string _pluginId;
        private readonly List<string> _contributions;

        public PluginApi(ClaimsCore core, string pluginId, List<string> contributions)
        {
            _core = core;
            _pluginId = pluginId;
            _contributions = contributions;
        }

        public void RegisterClaimRules(string region, IClaimRules rules)
        {
            _core._rulesByRegion[region] = rules; // registering a region again replaces its rules
            _contributions.Add($"claim rules: {region}");
        }

        public void AddClaimListener(ClaimListener listener)
        {
            _core._listeners.Add(listener);
            _contributions.Add("claim listener");
        }

        public void Log(string message)
        {
            Console.WriteLine($"[{_pluginId}] {message}");
        }
    }
}
// [/core]

// [caRules]
/// California: a 500.00 deductible. Knows only the contract, never another plug-in or the core class.
sealed class CaRulesPlugin : IPlugin
{
    public string Id => "ca-rules";
    public int ApiVersion => 2;

    public void Activate(ICoreApi core)
    {
        core.RegisterClaimRules("CA", new DeductibleRules());
    }

    private sealed class DeductibleRules : IClaimRules
    {
        public long Assess(Claim claim) => Math.Max(0L, claim.AmountCents - 50000);
    }
}
// [/caRules]

// [nyRules]
/// New York: payouts are capped at 2000.00.
sealed class NyRulesPlugin : IPlugin
{
    public string Id => "ny-rules";
    public int ApiVersion => 2;

    public void Activate(ICoreApi core)
    {
        core.RegisterClaimRules("NY", new CappedRules());
    }

    private sealed class CappedRules : IClaimRules
    {
        public long Assess(Claim claim) => Math.Min(claim.AmountCents, 200000L);
    }
}
// [/nyRules]

// [auditLog]
/// Extends the core through the other extension point: a listener that logs through the core's own log service.
sealed class AuditLogPlugin : IPlugin
{
    public string Id => "audit-log";
    public int ApiVersion => 2;

    public void Activate(ICoreApi core)
    {
        core.AddClaimListener(decision =>
        {
            core.Log($"{decision.ClaimId} {decision.Region} {decision.Status}");
        });
    }
}
// [/auditLog]

// [legacyTx]
/// <summary>
/// Built for the old contract (version 1). The core refuses it at install time, so this
/// Activate never runs and its rules are never registered.
/// </summary>
sealed class LegacyTxPlugin : IPlugin
{
    public string Id => "legacy-tx";
    public int ApiVersion => 1;

    public void Activate(ICoreApi core)
    {
        core.RegisterClaimRules("TX", new FullPayoutRules());
    }

    private sealed class FullPayoutRules : IClaimRules
    {
        public long Assess(Claim claim) => claim.AmountCents;
    }
}
// [/legacyTx]

// [txRules]
/// Texas, rebuilt for the current contract: a 250.00 deductible.
sealed class TxRulesPlugin : IPlugin
{
    public string Id => "tx-rules";
    public int ApiVersion => 2;

    public void Activate(ICoreApi core)
    {
        core.RegisterClaimRules("TX", new DeductibleRules());
    }

    private sealed class DeductibleRules : IClaimRules
    {
        public long Assess(Claim claim) => Math.Max(0L, claim.AmountCents - 25000);
    }
}
// [/txRules]
