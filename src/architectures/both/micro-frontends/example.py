from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


# [services]
class CatalogService:
    """
    The shared backend services. Each counts its calls: the counter goes up at the start of
    every call, before anything can fail, so a call that fails is still counted. Money is
    integer cents everywhere. A sku a service does not know is a programmer bug, so it raises.
    """

    def __init__(self) -> None:
        self.calls = 0
        self._names: dict[str, str] = {"sku-1": "Widget"}

    def name(self, sku: str) -> str:
        self.calls += 1
        name = self._names.get(sku)
        if name is None:
            raise LookupError(f"unknown sku {sku}")
        return name


class PricingService:
    def __init__(self) -> None:
        self.calls = 0
        self._prices: dict[str, int] = {"sku-1": 1999}

    def price_cents(self, sku: str) -> int:
        self.calls += 1
        cents = self._prices.get(sku)
        if cents is None:
            raise LookupError(f"unknown sku {sku}")
        return cents


class StockService:
    def __init__(self) -> None:
        self.calls = 0
        self._units: dict[str, int] = {"sku-1": 3}

    def in_stock(self, sku: str) -> int:
        self.calls += 1
        units = self._units.get(sku)
        if units is None:
            raise LookupError(f"unknown sku {sku}")
        return units


class RecommendationService:
    """The one service that can be switched off, to show that a failure stays inside its team's slot."""

    def __init__(self) -> None:
        self.calls = 0
        self._down = False
        self._related_by_sku: dict[str, list[str]] = {"sku-1": ["Gadget", "Gizmo"]}

    def set_down(self, down: bool) -> None:
        self._down = down

    def related(self, sku: str) -> list[str]:
        self.calls += 1
        if self._down:
            raise RuntimeError("recommendation service unavailable")
        names = self._related_by_sku.get(sku)
        if names is None:
            raise LookupError(f"unknown sku {sku}")
        return list(names)


def format_cents(cents: int) -> str:
    """Formats 1999 as "19.99" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator)."""
    absolute = abs(cents)
    whole = absolute // 100
    fraction = absolute % 100
    sign = "-" if cents < 0 else ""
    return f"{sign}{whole}.{fraction:02d}"
# [/services]


# [shell]
class Fragment(Protocol):
    """
    What every team hands to the shell: who owns the fragment, which release it is, and a
    render function that returns an HTML string for one product.

    Fragments here return strings built from trusted constant data. A real fragment must
    escape every value it puts into markup (names, prices, user input), or it opens the page
    to injection.
    """

    @property
    def team(self) -> str: ...

    @property
    def version(self) -> str: ...

    def render(self, sku: str) -> str: ...


class FragmentRegistry:
    """
    Which fragment each team currently serves. register adds a fragment without a word (the
    set the shell starts with); deploy is the later release path: it replaces that team's
    fragment and says so. Either way the team keeps its one slot, and the order of the page
    comes only from the shell's template, never from this dict.
    """

    def __init__(self) -> None:
        self._fragments: dict[str, Fragment] = {}

    def register(self, fragment: Fragment) -> None:
        self._fragments[fragment.team] = fragment

    def deploy(self, fragment: Fragment) -> None:
        self._fragments[fragment.team] = fragment
        print(f"[registry] {fragment.team} deployed {fragment.version}")

    def get(self, team: str) -> Fragment:
        fragment = self._fragments.get(team)
        # A template slot nobody has registered is a programmer bug, not a failed fragment.
        if fragment is None:
            raise LookupError(f"no fragment registered for {team}")
        return fragment


class Shell:
    """
    The shell, owned by a platform team: it composes the page. These examples compose on the
    server, like Server-Side Includes, Edge-Side Includes, Zalando's Tailor or FINN.no's
    Podium, because they must run as plain code in TypeScript, C#, Python and Go. Many real
    micro-frontends compose in the browser instead: Webpack Module Federation, Web
    Components, single-spa or iframes. Neither way is the only one.

    The page template is an ordered list of slots. render_page walks that list, never the
    registry, so the order is the same on every run. If a fragment fails, the shell puts a
    comment in its slot and carries on: one team's failure does not take the page down.
    """

    def __init__(self, registry: FragmentRegistry) -> None:
        self._registry = registry
        self._slots = ["product", "checkout", "inspire"]

    def render_page(self, sku: str) -> str:
        parts: list[str] = []
        for team in self._slots:
            fragment = self._registry.get(team)
            try:
                parts.append(fragment.render(sku))
            except Exception:
                parts.append(f"<!-- {team} unavailable -->")
        return f"<main>{''.join(parts)}</main>"
# [/shell]


# [productTeam]
class ProductFragment:
    """The Product team's fragment: the product's name as a heading, read from the catalog."""

    team = "product"
    version = "product-details v1"

    def __init__(self, catalog: CatalogService) -> None:
        self._catalog = catalog

    def render(self, sku: str) -> str:
        return f"<h1>{self._catalog.name(sku)}</h1>"
# [/productTeam]


# [checkoutTeam]
@dataclass(frozen=True)
class BuyBoxModel:
    """The one thing the buy box needs to know about a product."""

    price_cents: int
    in_stock: int


class CheckoutWebBff:
    """
    The Checkout team's backend for its own web fragment (the Checkout web BFF). It puts one
    call in front of two services (a facade) and reshapes their answers into the buy box's
    model (an adapter): that shape and nothing more.
    """

    def __init__(self, pricing: PricingService, stock: StockService) -> None:
        self._pricing = pricing
        self._stock = stock

    def buy_box(self, sku: str) -> BuyBoxModel:
        price_cents = self._pricing.price_cents(sku)
        in_stock = self._stock.in_stock(sku)
        return BuyBoxModel(price_cents=price_cents, in_stock=in_stock)


class BuyBoxV1:
    """Release 1 of the buy box: the price and how many are left."""

    team = "checkout"
    version = "buy-box v1"

    def __init__(self, bff: CheckoutWebBff) -> None:
        self._bff = bff

    def render(self, sku: str) -> str:
        model = self._bff.buy_box(sku)
        return f"<button>Buy for {format_cents(model.price_cents)} ({model.in_stock} left)</button>"


class BuyBoxV2:
    """
    Release 2 of the buy box, shipped by the Checkout team alone: new wording, and it no
    longer shows the stock count. It still asks the BFF for the whole model, so pricing and
    stock are both still called.
    """

    team = "checkout"
    version = "buy-box v2"

    def __init__(self, bff: CheckoutWebBff) -> None:
        self._bff = bff

    def render(self, sku: str) -> str:
        model = self._bff.buy_box(sku)
        return f"<button>Add to basket: {format_cents(model.price_cents)}</button>"
# [/checkoutTeam]


# [inspireTeam]
class RecommendationsFragment:
    """
    The Inspire team's fragment: a list of related products. It does not catch the service's
    error; deciding what the page does when this fragment fails is the shell's job.
    """

    team = "inspire"
    version = "recommendations v1"

    def __init__(self, recommendations: RecommendationService) -> None:
        self._recommendations = recommendations

    def render(self, sku: str) -> str:
        items = [f"<li>{name}</li>" for name in self._recommendations.related(sku)]
        return f"<ul>{''.join(items)}</ul>"
# [/inspireTeam]


# [mobileBff]
@dataclass(frozen=True)
class MobileProductCard:
    """What the mobile app gets for a product: strings and a flag, ready to show."""

    name: str
    price: str
    in_stock: bool


class MobileBff:
    """
    The Mobile team's backend, built for one client type, the mobile app. It puts one call in
    front of three services (a facade) and reshapes their answers into the app's own card
    (an adapter): a formatted price and a yes/no instead of a count.
    """

    def __init__(self, catalog: CatalogService, pricing: PricingService, stock: StockService) -> None:
        self._catalog = catalog
        self._pricing = pricing
        self._stock = stock

    def product_card(self, sku: str) -> MobileProductCard:
        name = self._catalog.name(sku)
        cents = self._pricing.price_cents(sku)
        units = self._stock.in_stock(sku)
        return MobileProductCard(name=name, price=format_cents(cents), in_stock=units > 0)


def to_wire(card: MobileProductCard) -> str:
    """
    The compact JSON the app receives, written out by hand so every language prints the same
    characters: no spaces, keys in this order. The values here are trusted constants; a real
    serializer would escape them. The bool is spelled out because str(True) is "True".
    """
    in_stock = "true" if card.in_stock else "false"
    return f'{{"name":"{card.name}","price":"{card.price}","inStock":{in_stock}}}'
# [/mobileBff]


# [usage]
catalog = CatalogService()
pricing = PricingService()
stock = StockService()
recommendations = RecommendationService()

checkout_bff = CheckoutWebBff(pricing, stock)
mobile_bff = MobileBff(catalog, pricing, stock)

# The shell starts with these three fragments. register is silent; deploy, used later, prints.
registry = FragmentRegistry()
registry.register(ProductFragment(catalog))
registry.register(BuyBoxV1(checkout_bff))
registry.register(RecommendationsFragment(recommendations))
shell = Shell(registry)

print(f"page: {shell.render_page('sku-1')}")
print(f"mobile: {to_wire(mobile_bff.product_card('sku-1'))}")

# The Checkout team ships a new buy box. No other team and not the shell is redeployed.
registry.deploy(BuyBoxV2(checkout_bff))

# The recommendation service fails; the page still renders, without that fragment.
recommendations.set_down(True)
print("[inspire] recommendation service goes down")
print(f"page: {shell.render_page('sku-1')}")

print(
    f"service calls: catalog {catalog.calls}, pricing {pricing.calls}, "
    f"stock {stock.calls}, recommendations {recommendations.calls}"
)
# [/usage]
