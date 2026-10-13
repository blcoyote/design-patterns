from collections.abc import Callable
from dataclasses import dataclass


# [http]
@dataclass(frozen=True)
class GatewayRequest:
    """What a client sends to the gateway: plain data, no network involved."""

    token: str
    method: str
    path: str


@dataclass(frozen=True)
class GatewayResponse:
    status: int
    body: str


# A route handler gets the authenticated user id and builds the response.
RouteHandler = Callable[[str], GatewayResponse]
# [/http]


# [services]
@dataclass(frozen=True)
class Profile:
    name: str
    email: str


@dataclass(frozen=True)
class OrderSummary:
    id: str
    items: int


# The services trust the user id the gateway hands them. Real systems pass a
# signed token (e.g. a JWT) or secure the gateway-to-service hop (e.g. mTLS), so
# a caller that bypasses the gateway cannot claim to be someone else.
class UserService:
    def __init__(self) -> None:
        self.calls = 0  # counted first thing in profile(), so the usage can show who was reached
        self._profiles = {
            'alice': Profile('Alice', 'alice@example.com'),
            'bob': Profile('Bob', 'bob@example.com'),
        }

    def profile(self, user_id: str) -> Profile:
        self.calls += 1
        found = self._profiles.get(user_id)
        if found is None:
            raise ValueError(f'unknown user {user_id}')  # the gateway only passes ids it authenticated
        return found


class OrderService:
    def __init__(self) -> None:
        self.calls = 0  # counted first thing in recent()
        self._orders = {
            'alice': [OrderSummary('order-1', 2), OrderSummary('order-2', 3)],
        }

    def recent(self, user_id: str) -> list[OrderSummary]:
        self.calls += 1
        return self._orders.get(user_id, [])  # bob has no entry: no orders
# [/services]


# [authenticator]
class Authenticator:
    def __init__(self) -> None:
        self._users = {
            'token-alice': 'alice',
            'token-bob': 'bob',
        }

    def authenticate(self, token: str) -> str | None:
        """The user id for a known token, or None for an unknown one."""
        return self._users.get(token)
# [/authenticator]


# [rateLimiter]
# A fixed-window counter per user. The window is advanced by an explicit
# next_window() call instead of a clock, so the example stays deterministic. Real
# limiters often use sliding windows or token buckets, and keep their counters in
# shared storage (e.g. Redis) when the gateway runs as several instances.
class FixedWindowRateLimiter:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self._counts: dict[str, int] = {}

    def try_acquire(self, user_id: str) -> bool:
        """Counts the request and returns True while the user is under the limit."""
        used = self._counts.get(user_id, 0)
        if used >= self.limit:
            return False  # rejected requests are not counted
        self._counts[user_id] = used + 1
        return True

    def used(self, user_id: str) -> int:
        return self._counts.get(user_id, 0)

    def next_window(self) -> None:
        """Starts a new window: every user's count goes back to zero."""
        self._counts.clear()
# [/rateLimiter]


# [aggregation]
# Aggregation: one client call becomes two service calls, composed into a single
# response. This handler is a Facade over the two services.
def home_route(users: UserService, orders: OrderService) -> RouteHandler:
    def handler(user_id: str) -> GatewayResponse:
        profile = users.profile(user_id)
        recent = orders.recent(user_id)
        return GatewayResponse(200, f'{profile.name}: {len(recent)} orders')

    return handler
# [/aggregation]


# [routes]
# The route table: the exact string "<METHOD> <path>" maps to a handler.
def create_routes(users: UserService, orders: OrderService) -> dict[str, RouteHandler]:
    def profile_route(user_id: str) -> GatewayResponse:
        profile = users.profile(user_id)
        return GatewayResponse(200, f'{profile.name} <{profile.email}>')

    def orders_route(user_id: str) -> GatewayResponse:
        recent = orders.recent(user_id)
        if len(recent) == 0:
            body = 'no orders'
        else:
            body = ', '.join(f'{order.id} ({order.items} items)' for order in recent)
        return GatewayResponse(200, body)

    return {
        'GET /profile': profile_route,
        'GET /orders': orders_route,
        'GET /home': home_route(users, orders),
    }
# [/routes]


# [gateway]
# A real gateway (Kong, Amazon API Gateway, YARP, ...) is a separate network
# process configured with routes and plugins. Here it is an in-process class and
# the requests are plain objects, so the example runs the same in every language.
# The checks below are a fixed sequence; real gateways usually build them as a
# configurable filter chain, which is the Middleware pattern.
class ApiGateway:
    def __init__(
        self,
        authenticator: Authenticator,
        limiter: FixedWindowRateLimiter,
        routes: dict[str, RouteHandler],
    ) -> None:
        self._authenticator = authenticator
        self._limiter = limiter
        self._routes = routes

    def handle(self, request: GatewayRequest) -> GatewayResponse:
        user_id = self._authenticator.authenticate(request.token)
        if user_id is None:
            return GatewayResponse(401, 'unknown token')  # nothing else runs
        if not self._limiter.try_acquire(user_id):
            return GatewayResponse(429, f'rate limit: {self._limiter.limit} requests per window')
        # Limiting happens before routing, so a request with no route still counts.
        route = self._routes.get(f'{request.method} {request.path}')
        if route is None:
            return GatewayResponse(404, f'no route for {request.method} {request.path}')
        return route(user_id)

    def next_window(self) -> None:
        self._limiter.next_window()
# [/gateway]


# [usage]
users = UserService()
orders = OrderService()
limiter = FixedWindowRateLimiter(3)
gateway = ApiGateway(Authenticator(), limiter, create_routes(users, orders))


def send(gateway: ApiGateway, token: str, method: str, path: str) -> None:
    response = gateway.handle(GatewayRequest(token, method, path))
    print(f'{method} {path} [{token}] -> {response.status} {response.body}')


send(gateway, 'token-alice', 'GET', '/profile')  # 200 Alice <alice@example.com>
send(gateway, 'token-alice', 'GET', '/orders')  # 200 order-1 (2 items), order-2 (3 items)
send(gateway, 'token-alice', 'GET', '/home')  # 200 Alice: 2 orders (two service calls)
send(gateway, 'token-mallory', 'GET', '/orders')  # 401: no limiter check, no service call
send(gateway, 'token-alice', 'GET', '/profile')  # 429: alice has used 3 of 3, not counted
print('[gateway] next window')
gateway.next_window()
send(gateway, 'token-alice', 'GET', '/admin')  # 404, but it still counts: alice 1/3
send(gateway, 'token-bob', 'GET', '/orders')  # 200 no orders: bob is counted separately from alice

print(f'backend calls: users {users.calls}, orders {orders.calls}')  # users 2, orders 3
print(
    f'rate limit: alice {limiter.used("alice")}/{limiter.limit}, bob {limiter.used("bob")}/{limiter.limit}'
)  # alice 1/3, bob 1/3
# [/usage]
