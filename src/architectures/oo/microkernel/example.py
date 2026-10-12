from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, Protocol


# [contracts]
# Everything a plug-in may see: the contract. Plug-ins are written against these types and
# nothing else. The core's own class, its registry and its internals are not part of it.

# The version of the plug-in contract this core provides. A plug-in built for another version is refused.
CORE_API_VERSION = 2


@dataclass(frozen=True)
class Claim:
    """Money is integer cents everywhere."""

    id: str
    region: str
    amount_cents: int


@dataclass(frozen=True)
class ClaimDecision:
    claim_id: str
    region: str
    status: Literal["approved", "manual review"]
    payout_cents: int  # 0 for a manual review
    reason: str  # empty string when approved


class ClaimRules(Protocol):
    """An extension point: how one region turns a claim into a payout."""

    def assess(self, claim: Claim) -> int:
        """Returns the payout in cents."""
        ...


# A second extension point: called with every decision the core makes.
ClaimListener = Callable[[ClaimDecision], None]


class CoreApi(Protocol):
    """The core services a plug-in receives while it is being activated."""

    def register_claim_rules(self, region: str, rules: ClaimRules) -> None: ...

    def add_claim_listener(self, listener: ClaimListener) -> None: ...

    def log(self, message: str) -> None: ...


class Plugin(Protocol):
    id: str
    api_version: int  # the contract version this plug-in was built against

    def activate(self, core: CoreApi) -> None: ...


def format_cents(cents: int) -> str:
    """Formats 55000 as "550.00" with integer arithmetic only (no floats, no thousands separator)."""
    whole = cents // 100
    fraction = cents % 100
    return f"{whole}.{fraction:02d}"
# [/contracts]


# [core]
class ClaimsCore:
    """
    The core system. It has its own job (processing claims) and nothing region-specific: all
    of that arrives through plug-ins. It never names a plug-in class; it only knows the Plugin
    contract. In this one-file demo the composition (which plug-ins to install) happens in usage.
    """

    def __init__(self) -> None:
        # The registry: one extension point keyed by region, one ordered list of listeners.
        self._rules_by_region: dict[str, ClaimRules] = {}
        self._listeners: list[ClaimListener] = []

    def install(self, plugin: Plugin) -> bool:
        """
        Installs a plug-in. Returns False when the contract version does not match: that is a
        printed line and a False result, not an exception, and activate is never called.
        """
        if plugin.api_version != CORE_API_VERSION:
            print(
                f"[core] rejected {plugin.id}: needs core API {plugin.api_version}, core provides {CORE_API_VERSION}"
            )
            return False

        # Each plug-in gets its own CoreApi, so the core can record what that plug-in contributed
        # and tag its log lines with the plug-in id.
        contributions: list[str] = []
        rules_by_region = self._rules_by_region
        listeners = self._listeners
        plugin_id = plugin.id

        class PluginCoreApi:
            def register_claim_rules(self, region: str, rules: ClaimRules) -> None:
                rules_by_region[region] = rules  # registering a region again replaces its rules
                contributions.append(f"claim rules: {region}")

            def add_claim_listener(self, listener: ClaimListener) -> None:
                listeners.append(listener)
                contributions.append("claim listener")

            def log(self, message: str) -> None:
                print(f"[{plugin_id}] {message}")

        plugin.activate(PluginCoreApi())
        print(f"[core] loaded {plugin.id} ({', '.join(contributions)})")
        return True

    def process(self, claim: Claim) -> ClaimDecision:
        rules = self._rules_by_region.get(claim.region)
        if rules is None:
            decision = ClaimDecision(
                claim_id=claim.id,
                region=claim.region,
                status="manual review",
                payout_cents=0,
                reason=f"no rules for {claim.region}",
            )
        else:
            decision = ClaimDecision(
                claim_id=claim.id,
                region=claim.region,
                status="approved",
                payout_cents=rules.assess(claim),
                reason="",
            )

        # Iterate a snapshot: a listener added during notification first hears the next decision.
        for listener in list(self._listeners):
            listener(decision)
        return decision
# [/core]


# [caRules]
class _CaClaimRules:
    def assess(self, claim: Claim) -> int:
        return max(0, claim.amount_cents - 50000)


class CaRulesPlugin:
    """California: a 500.00 deductible. Knows only the contract, never another plug-in or the core class."""

    id = "ca-rules"
    api_version = 2

    def activate(self, core: CoreApi) -> None:
        core.register_claim_rules("CA", _CaClaimRules())
# [/caRules]


# [nyRules]
class _NyClaimRules:
    def assess(self, claim: Claim) -> int:
        return min(claim.amount_cents, 200000)


class NyRulesPlugin:
    """New York: payouts are capped at 2000.00."""

    id = "ny-rules"
    api_version = 2

    def activate(self, core: CoreApi) -> None:
        core.register_claim_rules("NY", _NyClaimRules())
# [/nyRules]


# [auditLog]
class AuditLogPlugin:
    """Extends the core through the other extension point: a listener that logs through the core's own log service."""

    id = "audit-log"
    api_version = 2

    def activate(self, core: CoreApi) -> None:
        core.add_claim_listener(
            lambda decision: core.log(f"{decision.claim_id} {decision.region} {decision.status}")
        )
# [/auditLog]


# [legacyTx]
class _LegacyTxClaimRules:
    def assess(self, claim: Claim) -> int:
        return claim.amount_cents


class LegacyTxPlugin:
    """
    Built for the old contract (version 1). The core refuses it at install time, so this
    activate never runs and its rules are never registered.
    """

    id = "legacy-tx"
    api_version = 1

    def activate(self, core: CoreApi) -> None:
        core.register_claim_rules("TX", _LegacyTxClaimRules())
# [/legacyTx]


# [txRules]
class _TxClaimRules:
    def assess(self, claim: Claim) -> int:
        return max(0, claim.amount_cents - 25000)


class TxRulesPlugin:
    """Texas, rebuilt for the current contract: a 250.00 deductible."""

    id = "tx-rules"
    api_version = 2

    def activate(self, core: CoreApi) -> None:
        core.register_claim_rules("TX", _TxClaimRules())
# [/txRules]


# [usage]
def describe(decision: ClaimDecision) -> str:
    if decision.status == "approved":
        return f"{decision.claim_id}: approved, payout {format_cents(decision.payout_cents)}"
    return f"{decision.claim_id}: manual review, {decision.reason}"


core = ClaimsCore()
core.install(CaRulesPlugin())
core.install(NyRulesPlugin())
core.install(AuditLogPlugin())
core.install(LegacyTxPlugin())  # rejected: needs API 1, the core provides 2

print(describe(core.process(Claim("claim-1", "CA", 150000))))
print(describe(core.process(Claim("claim-2", "NY", 350000))))
# No TX rules are installed, and the core keeps working: a manual review, not a failure.
print(describe(core.process(Claim("claim-3", "TX", 80000))))

# A plug-in installed later: ClaimsCore is untouched.
core.install(TxRulesPlugin())
print(describe(core.process(Claim("claim-3", "TX", 80000))))
# [/usage]
