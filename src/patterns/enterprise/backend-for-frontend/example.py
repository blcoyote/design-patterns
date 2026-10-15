import json
from dataclasses import dataclass


# [services]
# Shared backend services. They know nothing about the clients and return their
# data in one general shape. Each counts its calls first thing, so the usage can
# show which services a request reached.
@dataclass(frozen=True)
class Profile:
    name: str
    email: str


@dataclass(frozen=True)
class Order:
    id: str
    items: int
    total_cents: int


class ProfileService:
    def __init__(self) -> None:
        self.calls = 0
        self._profiles = {
            'alice': Profile('Alice', 'alice@example.com'),
            'bob': Profile('Bob', 'bob@example.com'),
        }

    def profile(self, user_id: str) -> Profile:
        self.calls += 1
        found = self._profiles.get(user_id)
        if found is None:
            raise ValueError(f'unknown user {user_id}')
        return found


class OrderService:
    def __init__(self) -> None:
        self.calls = 0
        self._orders = {
            'alice': [Order('order-1', 2, 1250), Order('order-2', 3, 4999)],
        }

    def recent(self, user_id: str) -> list[Order]:
        """Oldest first; bob has no entry, so no orders."""
        self.calls += 1
        return self._orders.get(user_id, [])


class RecommendationService:
    def __init__(self) -> None:
        self.calls = 0
        self.down = False  # the usage switches this on to show a failing service
        self._picks = {
            'alice': ['socks', 'mug', 'lamp'],
            'bob': ['notebook'],
        }

    def for_user(self, user_id: str) -> list[str]:
        self.calls += 1
        if self.down:
            raise RuntimeError('recommendations unavailable')
        return self._picks.get(user_id, [])
# [/services]


# [webBff]
# The web team's backend. The account page shows everything, so it calls all
# three services and returns a page model shaped for the web UI. Calls run one
# after another here to keep the example deterministic; a real BFF would
# usually make independent calls in parallel.
@dataclass(frozen=True)
class AccountPage:
    heading: str
    order_lines: list[str]
    recommended: list[str] | None  # None: the section could not be filled


def format_cents(cents: int) -> str:
    return f'{cents // 100}.{cents % 100:02d}'


class WebBff:
    def __init__(
        self,
        profiles: ProfileService,
        orders: OrderService,
        recommendations: RecommendationService,
    ) -> None:
        self._profiles = profiles
        self._orders = orders
        self._recommendations = recommendations

    def account_page(self, user_id: str) -> AccountPage:
        profile = self._profiles.profile(user_id)
        orders = self._orders.recent(user_id)
        recommended: list[str] | None
        try:
            recommended = self._recommendations.for_user(user_id)
        except RuntimeError:
            recommended = None  # the web page degrades: the rest of it is still served
        return AccountPage(
            heading=f'{profile.name} ({profile.email})',
            order_lines=[
                f'{order.id}: {order.items} items, {format_cents(order.total_cents)}'
                for order in orders
            ],
            recommended=recommended,
        )
# [/webBff]


# [mobileBff]
# The mobile team's backend. The app's home screen shows a small card, so this
# BFF calls only the two services it needs, never recommendations, and answers
# with compact JSON in the app's own field names.
@dataclass(frozen=True)
class MobileHomeCard:
    name: str
    order_count: int
    last_order: str | None


class MobileBff:
    def __init__(self, profiles: ProfileService, orders: OrderService) -> None:
        self._profiles = profiles
        self._orders = orders

    def home(self, user_id: str) -> str:
        profile = self._profiles.profile(user_id)
        orders = self._orders.recent(user_id)
        card = MobileHomeCard(
            name=profile.name,
            order_count=len(orders),
            last_order=None if len(orders) == 0 else orders[-1].id,
        )
        wire = {'name': card.name, 'orderCount': card.order_count, 'lastOrder': card.last_order}
        return json.dumps(wire, separators=(',', ':'))
# [/mobileBff]


# [clients]
# Each client knows only its own BFF, never the services behind it.
def show_web_account(bff: WebBff, user_id: str) -> None:
    page = bff.account_page(user_id)
    print(f'[web] {page.heading}')
    if len(page.order_lines) == 0:
        print('[web]   no orders')
    for line in page.order_lines:
        print(f'[web]   {line}')
    recommended = 'unavailable' if page.recommended is None else ', '.join(page.recommended)
    print(f'[web]   recommended: {recommended}')


def show_mobile_home(bff: MobileBff, user_id: str) -> None:
    print(f'[mobile] {bff.home(user_id)}')
# [/clients]


# [usage]
def main() -> None:
    profiles = ProfileService()
    orders = OrderService()
    recommendations = RecommendationService()
    web_bff = WebBff(profiles, orders, recommendations)
    mobile_bff = MobileBff(profiles, orders)

    show_web_account(web_bff, 'alice')  # three service calls: heading, two order lines, three picks
    show_mobile_home(mobile_bff, 'alice')  # {"name":"Alice","orderCount":2,"lastOrder":"order-2"}
    show_mobile_home(mobile_bff, 'bob')  # {"name":"Bob","orderCount":0,"lastOrder":null}

    print('[recommendations] down')
    recommendations.down = True
    show_web_account(web_bff, 'bob')  # no orders, recommended: unavailable

    print(
        f'service calls: profile {profiles.calls}, orders {orders.calls}, '
        f'recommendations {recommendations.calls}'
    )  # profile 4, orders 4, recommendations 2


main()
# [/usage]
