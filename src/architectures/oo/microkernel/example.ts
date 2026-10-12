// [contracts]
/**
 * Everything a plug-in may see: the contract. Plug-ins are written against these types and
 * nothing else. The core's own class, its registry and its internals are not part of it.
 */

/** The version of the plug-in contract this core provides. A plug-in built for another version is refused. */
const CORE_API_VERSION = 2;

/** Money is integer cents everywhere. */
interface Claim {
  id: string;
  region: string;
  amountCents: number;
}

interface ClaimDecision {
  claimId: string;
  region: string;
  status: "approved" | "manual review";
  /** 0 for a manual review. */
  payoutCents: number;
  /** Empty string when approved. */
  reason: string;
}

/** An extension point: how one region turns a claim into a payout. */
interface ClaimRules {
  /** Returns the payout in cents. */
  assess(claim: Claim): number;
}

/** A second extension point: called with every decision the core makes. */
type ClaimListener = (decision: ClaimDecision) => void;

/** The core services a plug-in receives while it is being activated. */
interface CoreApi {
  registerClaimRules(region: string, rules: ClaimRules): void;
  addClaimListener(listener: ClaimListener): void;
  log(message: string): void;
}

interface Plugin {
  readonly id: string;
  /** The contract version this plug-in was built against. */
  readonly apiVersion: number;
  activate(core: CoreApi): void;
}

/** Formats 55000 as "550.00" with integer arithmetic only (no floats, no thousands separator). */
function formatCents(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}
// [/contracts]

// [core]
/**
 * The core system. It has its own job (processing claims) and nothing region-specific: all
 * of that arrives through plug-ins. It never names a plug-in class; it only knows the Plugin
 * contract. In this one-file demo the composition (which plug-ins to install) happens in usage.
 */
class ClaimsCore {
  // The registry: one extension point keyed by region, one ordered list of listeners.
  private readonly rulesByRegion = new Map<string, ClaimRules>();
  private readonly listeners: ClaimListener[] = [];

  /**
   * Installs a plug-in. Returns false when the contract version does not match: that is a
   * printed line and a false result, not an exception, and activate is never called.
   */
  install(plugin: Plugin): boolean {
    if (plugin.apiVersion !== CORE_API_VERSION) {
      console.log(
        `[core] rejected ${plugin.id}: needs core API ${plugin.apiVersion}, core provides ${CORE_API_VERSION}`,
      );
      return false;
    }

    // Each plug-in gets its own CoreApi, so the core can record what that plug-in contributed
    // and tag its log lines with the plug-in id.
    const contributions: string[] = [];
    const api: CoreApi = {
      registerClaimRules: (region, rules) => {
        this.rulesByRegion.set(region, rules); // registering a region again replaces its rules
        contributions.push(`claim rules: ${region}`);
      },
      addClaimListener: (listener) => {
        this.listeners.push(listener);
        contributions.push("claim listener");
      },
      log: (message) => {
        console.log(`[${plugin.id}] ${message}`);
      },
    };

    plugin.activate(api);
    console.log(`[core] loaded ${plugin.id} (${contributions.join(", ")})`);
    return true;
  }

  process(claim: Claim): ClaimDecision {
    const rules = this.rulesByRegion.get(claim.region);
    const decision: ClaimDecision =
      rules === undefined
        ? {
            claimId: claim.id,
            region: claim.region,
            status: "manual review",
            payoutCents: 0,
            reason: `no rules for ${claim.region}`,
          }
        : {
            claimId: claim.id,
            region: claim.region,
            status: "approved",
            payoutCents: rules.assess(claim),
            reason: "",
          };

    // Iterate a snapshot: a listener added during notification first hears the next decision.
    for (const listener of [...this.listeners]) listener(decision);
    return decision;
  }
}
// [/core]

// [caRules]
/** California: a 500.00 deductible. Knows only the contract, never another plug-in or the core class. */
class CaRulesPlugin implements Plugin {
  readonly id = "ca-rules";
  readonly apiVersion = 2;

  activate(core: CoreApi): void {
    core.registerClaimRules("CA", {
      assess: (claim) => Math.max(0, claim.amountCents - 50000),
    });
  }
}
// [/caRules]

// [nyRules]
/** New York: payouts are capped at 2000.00. */
class NyRulesPlugin implements Plugin {
  readonly id = "ny-rules";
  readonly apiVersion = 2;

  activate(core: CoreApi): void {
    core.registerClaimRules("NY", {
      assess: (claim) => Math.min(claim.amountCents, 200000),
    });
  }
}
// [/nyRules]

// [auditLog]
/** Extends the core through the other extension point: a listener that logs through the core's own log service. */
class AuditLogPlugin implements Plugin {
  readonly id = "audit-log";
  readonly apiVersion = 2;

  activate(core: CoreApi): void {
    core.addClaimListener((decision) => {
      core.log(`${decision.claimId} ${decision.region} ${decision.status}`);
    });
  }
}
// [/auditLog]

// [legacyTx]
/**
 * Built for the old contract (version 1). The core refuses it at install time, so this
 * activate never runs and its rules are never registered.
 */
class LegacyTxPlugin implements Plugin {
  readonly id = "legacy-tx";
  readonly apiVersion = 1;

  activate(core: CoreApi): void {
    core.registerClaimRules("TX", {
      assess: (claim) => claim.amountCents,
    });
  }
}
// [/legacyTx]

// [txRules]
/** Texas, rebuilt for the current contract: a 250.00 deductible. */
class TxRulesPlugin implements Plugin {
  readonly id = "tx-rules";
  readonly apiVersion = 2;

  activate(core: CoreApi): void {
    core.registerClaimRules("TX", {
      assess: (claim) => Math.max(0, claim.amountCents - 25000),
    });
  }
}
// [/txRules]

// [usage]
function describe(decision: ClaimDecision): string {
  return decision.status === "approved"
    ? `${decision.claimId}: approved, payout ${formatCents(decision.payoutCents)}`
    : `${decision.claimId}: manual review, ${decision.reason}`;
}

const core = new ClaimsCore();
core.install(new CaRulesPlugin());
core.install(new NyRulesPlugin());
core.install(new AuditLogPlugin());
core.install(new LegacyTxPlugin()); // rejected: needs API 1, the core provides 2

console.log(describe(core.process({ id: "claim-1", region: "CA", amountCents: 150000 })));
console.log(describe(core.process({ id: "claim-2", region: "NY", amountCents: 350000 })));
// No TX rules are installed, and the core keeps working: a manual review, not a failure.
console.log(describe(core.process({ id: "claim-3", region: "TX", amountCents: 80000 })));

// A plug-in installed later: ClaimsCore is untouched.
core.install(new TxRulesPlugin());
console.log(describe(core.process({ id: "claim-3", region: "TX", amountCents: 80000 })));
// [/usage]
