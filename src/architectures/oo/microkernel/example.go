package main

import (
	"fmt"
	"strings"
)

// [contracts]
// Everything a plug-in may see: the contract. Plug-ins are written against these types and
// nothing else. The core's own struct, its registry and its internals are not part of it.

// CoreAPIVersion is the version of the plug-in contract this core provides. A plug-in built for another version is refused.
const CoreAPIVersion = 2

// Claim: money is integer cents everywhere.
type Claim struct {
	ID          string
	Region      string
	AmountCents int
}

type ClaimDecision struct {
	ClaimID string
	Region  string
	Status  string // "approved" or "manual review"
	// PayoutCents is 0 for a manual review.
	PayoutCents int
	Reason      string // empty string when approved
}

// ClaimRules is an extension point: how one region turns a claim into a payout.
type ClaimRules interface {
	// Assess returns the payout in cents.
	Assess(claim Claim) int
}

// ClaimRulesFunc adapts a plain function to ClaimRules, the same trick as http.HandlerFunc.
type ClaimRulesFunc func(claim Claim) int

func (f ClaimRulesFunc) Assess(claim Claim) int { return f(claim) }

// ClaimListener is a second extension point: called with every decision the core makes.
type ClaimListener func(decision ClaimDecision)

// CoreAPI is the set of core services a plug-in receives while it is being activated.
type CoreAPI interface {
	RegisterClaimRules(region string, rules ClaimRules)
	AddClaimListener(listener ClaimListener)
	Log(message string)
}

type Plugin interface {
	ID() string
	// APIVersion is the contract version this plug-in was built against.
	APIVersion() int
	Activate(core CoreAPI)
}

// formatCents formats 55000 as "550.00" with integer arithmetic only (no floats, no thousands separator).
func formatCents(cents int) string {
	return fmt.Sprintf("%d.%02d", cents/100, cents%100)
}

// [/contracts]

// [core]
// ClaimsCore is the core system. It has its own job (processing claims) and nothing
// region-specific: all of that arrives through plug-ins. It never names a plug-in type; it only
// knows the Plugin contract. In this one-file demo the composition (which plug-ins to install)
// happens in usage.
type ClaimsCore struct {
	// The registry: one extension point keyed by region, one ordered slice of listeners.
	rulesByRegion map[string]ClaimRules
	listeners     []ClaimListener
}

func NewClaimsCore() *ClaimsCore {
	return &ClaimsCore{rulesByRegion: map[string]ClaimRules{}}
}

// pluginCoreAPI is the CoreAPI value one plug-in receives. It holds the core, the plug-in id and
// a pointer to that plug-in's contributions, so the core can record what the plug-in added and
// tag its log lines with the plug-in id.
type pluginCoreAPI struct {
	core          *ClaimsCore
	pluginID      string
	contributions *[]string
}

func (a pluginCoreAPI) RegisterClaimRules(region string, rules ClaimRules) {
	a.core.rulesByRegion[region] = rules // registering a region again replaces its rules
	*a.contributions = append(*a.contributions, "claim rules: "+region)
}

func (a pluginCoreAPI) AddClaimListener(listener ClaimListener) {
	a.core.listeners = append(a.core.listeners, listener)
	*a.contributions = append(*a.contributions, "claim listener")
}

func (a pluginCoreAPI) Log(message string) {
	fmt.Printf("[%s] %s\n", a.pluginID, message)
}

// Install installs a plug-in. It returns false when the contract version does not match: that
// is a printed line and a false result, not an error, and Activate is never called.
func (c *ClaimsCore) Install(plugin Plugin) bool {
	if plugin.APIVersion() != CoreAPIVersion {
		fmt.Printf("[core] rejected %s: needs core API %d, core provides %d\n", plugin.ID(), plugin.APIVersion(), CoreAPIVersion)
		return false
	}

	// Each plug-in gets its own CoreAPI value, so contributions are recorded per install.
	var contributions []string
	plugin.Activate(pluginCoreAPI{core: c, pluginID: plugin.ID(), contributions: &contributions})
	fmt.Printf("[core] loaded %s (%s)\n", plugin.ID(), strings.Join(contributions, ", "))
	return true
}

func (c *ClaimsCore) Process(claim Claim) ClaimDecision {
	var decision ClaimDecision
	rules, ok := c.rulesByRegion[claim.Region]
	if !ok {
		decision = ClaimDecision{
			ClaimID:     claim.ID,
			Region:      claim.Region,
			Status:      "manual review",
			PayoutCents: 0,
			Reason:      "no rules for " + claim.Region,
		}
	} else {
		decision = ClaimDecision{
			ClaimID:     claim.ID,
			Region:      claim.Region,
			Status:      "approved",
			PayoutCents: rules.Assess(claim),
			Reason:      "",
		}
	}

	// range evaluates c.listeners once, so this iterates a snapshot: a listener added during
	// notification first hears the next decision.
	for _, listener := range c.listeners {
		listener(decision)
	}
	return decision
}

// [/core]

// [caRules]
// CaRulesPlugin is California: a 500.00 deductible. Knows only the contract, never another plug-in or the core struct.
type CaRulesPlugin struct{}

func (CaRulesPlugin) ID() string      { return "ca-rules" }
func (CaRulesPlugin) APIVersion() int { return 2 }

func (CaRulesPlugin) Activate(core CoreAPI) {
	core.RegisterClaimRules("CA", ClaimRulesFunc(func(claim Claim) int {
		return max(0, claim.AmountCents-50000)
	}))
}

// [/caRules]

// [nyRules]
// NyRulesPlugin is New York: payouts are capped at 2000.00.
type NyRulesPlugin struct{}

func (NyRulesPlugin) ID() string      { return "ny-rules" }
func (NyRulesPlugin) APIVersion() int { return 2 }

func (NyRulesPlugin) Activate(core CoreAPI) {
	core.RegisterClaimRules("NY", ClaimRulesFunc(func(claim Claim) int {
		return min(claim.AmountCents, 200000)
	}))
}

// [/nyRules]

// [auditLog]
// AuditLogPlugin extends the core through the other extension point: a listener that logs through the core's own Log service.
type AuditLogPlugin struct{}

func (AuditLogPlugin) ID() string      { return "audit-log" }
func (AuditLogPlugin) APIVersion() int { return 2 }

func (AuditLogPlugin) Activate(core CoreAPI) {
	core.AddClaimListener(func(decision ClaimDecision) {
		core.Log(fmt.Sprintf("%s %s %s", decision.ClaimID, decision.Region, decision.Status))
	})
}

// [/auditLog]

// [legacyTx]
// LegacyTxPlugin was built for the old contract (version 1). The core refuses it at install
// time, so this Activate never runs and its rules are never registered.
type LegacyTxPlugin struct{}

func (LegacyTxPlugin) ID() string      { return "legacy-tx" }
func (LegacyTxPlugin) APIVersion() int { return 1 }

func (LegacyTxPlugin) Activate(core CoreAPI) {
	core.RegisterClaimRules("TX", ClaimRulesFunc(func(claim Claim) int {
		return claim.AmountCents
	}))
}

// [/legacyTx]

// [txRules]
// TxRulesPlugin is Texas, rebuilt for the current contract: a 250.00 deductible.
type TxRulesPlugin struct{}

func (TxRulesPlugin) ID() string      { return "tx-rules" }
func (TxRulesPlugin) APIVersion() int { return 2 }

func (TxRulesPlugin) Activate(core CoreAPI) {
	core.RegisterClaimRules("TX", ClaimRulesFunc(func(claim Claim) int {
		return max(0, claim.AmountCents-25000)
	}))
}

// [/txRules]

// [usage]
func describe(decision ClaimDecision) string {
	if decision.Status == "approved" {
		return fmt.Sprintf("%s: approved, payout %s", decision.ClaimID, formatCents(decision.PayoutCents))
	}
	return fmt.Sprintf("%s: manual review, %s", decision.ClaimID, decision.Reason)
}

func main() {
	core := NewClaimsCore()
	core.Install(CaRulesPlugin{})
	core.Install(NyRulesPlugin{})
	core.Install(AuditLogPlugin{})
	core.Install(LegacyTxPlugin{}) // rejected: needs API 1, the core provides 2

	fmt.Println(describe(core.Process(Claim{"claim-1", "CA", 150000})))
	fmt.Println(describe(core.Process(Claim{"claim-2", "NY", 350000})))
	// No TX rules are installed, and the core keeps working: a manual review, not a failure.
	fmt.Println(describe(core.Process(Claim{"claim-3", "TX", 80000})))

	// A plug-in installed later: ClaimsCore is untouched.
	core.Install(TxRulesPlugin{})
	fmt.Println(describe(core.Process(Claim{"claim-3", "TX", 80000})))
}

// [/usage]
