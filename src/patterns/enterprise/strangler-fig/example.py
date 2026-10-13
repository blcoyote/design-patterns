from dataclasses import dataclass, replace
from typing import Literal

Target = Literal['legacy', 'modern']


# [http]
@dataclass(frozen=True)
class Reply:
    """What either system answers: a status code and a body."""

    status: int
    body: str


@dataclass(frozen=True)
class Routed:
    """What the facade hands back: the reply plus which system produced it."""

    status: int
    body: str
    served_by: Target


def parse_path(path: str) -> tuple[str, str]:
    """'/products' -> ('products', ''), '/orders/42' -> ('orders', '42')."""
    parts = path.split('/')  # '/orders/42' -> ['', 'orders', '42']
    feature = parts[1] if len(parts) > 1 else ''
    order_id = parts[2] if len(parts) > 2 else ''
    return feature, order_id
# [/http]


# [legacy]
@dataclass(frozen=True)
class OrderRecord:
    id: str
    items: int


# The old code being strangled. It is never edited during the migration.
class LegacyMonolith:
    def __init__(self) -> None:
        self.calls = 0
        self._products = ['p-1', 'p-2', 'p-3']
        self._orders = [OrderRecord(id='42', items=2)]

    def handle(self, path: str) -> Reply:
        self.calls += 1
        feature, order_id = parse_path(path)
        order = next((o for o in self._orders if o.id == order_id), None)
        if feature == 'products':
            return Reply(200, f'{len(self._products)} products')
        if feature == 'orders':
            if order is not None:
                return Reply(200, f'order {order.id}, {order.items} items')
            return Reply(404, f'order {order_id} not found')
        if feature == 'invoices':
            if order is not None:
                return Reply(200, f'invoice for order {order.id}: {order.items} lines')
            return Reply(404, f'order {order_id} not found')
        raise ValueError(f'legacy has no feature "{feature}"')  # programmer bug, never exercised

    def orders_snapshot(self) -> list[OrderRecord]:
        """A copy of the order list, which the migration reads."""
        return [replace(o) for o in self._orders]
# [/legacy]


# [modern]
class ModernService:
    def __init__(self) -> None:
        self.calls = 0
        # The modern catalog was built with its own copy of the products before this example starts.
        self._products = ['p-1', 'p-2', 'p-3']
        self._orders: list[OrderRecord] = []  # empty until the migration imports orders

    def import_order(self, record: OrderRecord) -> None:
        self._orders.append(replace(record))

    def handle(self, path: str) -> Reply:
        self.calls += 1
        feature, order_id = parse_path(path)
        order = next((o for o in self._orders if o.id == order_id), None)
        if feature == 'products':
            return Reply(200, f'{len(self._products)} products')
        if feature == 'orders':
            if order is not None:
                return Reply(200, f'order {order.id}, {order.items} items')
            return Reply(404, f'order {order_id} not found')  # a wrong answer, not a crash
        if feature == 'invoices':
            if order is not None:
                return Reply(200, f'invoice for order {order.id}: {order.items} lines')
            return Reply(404, f'order {order_id} not found')
        raise ValueError(f'modern has no feature "{feature}"')  # programmer bug, never exercised
# [/modern]


# [migration]
# Moving the data is usually the hard part (dual writes, change data capture, sync jobs).
# One explicit copy stands in for all of that here.
def copy_orders(legacy: LegacyMonolith, modern: ModernService) -> int:
    records = legacy.orders_snapshot()
    for record in records:
        modern.import_order(record)
    print(f'[migration] orders copied to the modern store: {len(records)}')
    return len(records)
# [/migration]


# [facade]
FEATURES = ['products', 'orders', 'invoices']


# Real facades are reverse proxies, API gateways or load-balancer rules, sometimes with
# feature flags or a percentage of traffic. Here the facade is an in-process object, and a
# feature moves all at once by an explicit call.
class StranglerFacade:
    def __init__(self, legacy: LegacyMonolith, modern: ModernService) -> None:
        self.retired = False
        self._legacy = legacy
        self._modern = modern
        self._routes: dict[str, Target] = {f: 'legacy' for f in FEATURES}

    def handle(self, path: str) -> Routed:
        feature, _ = parse_path(path)
        target = self._routes.get(feature)
        if target is None:
            raise ValueError(f'facade has no route for "{feature}"')  # programmer bug, never exercised
        reply = self._legacy.handle(path) if target == 'legacy' else self._modern.handle(path)
        return Routed(reply.status, reply.body, target)

    def migrate(self, feature: str) -> None:
        self._routes[feature] = 'modern'
        print(f'[facade] {feature} -> modern')

    # Rollback only works here because nothing is written in this scenario, so the legacy side
    # still has current data. In a real system, writes made through the modern side must flow
    # back to the legacy side, or a rollback loses them.
    def rollback(self, feature: str) -> None:
        self._routes[feature] = 'legacy'
        print(f'[facade] {feature} -> legacy (rollback)')

    def retire_legacy(self) -> bool:
        """The legacy system can go only when no feature is routed to it."""
        still_legacy = [f for f in FEATURES if self._routes.get(f) == 'legacy']
        if still_legacy:
            print(f'[facade] cannot retire legacy: {", ".join(still_legacy)} still routed to it')
            return False
        self.retired = True
        print('[facade] legacy retired')
        return True
# [/facade]


# [usage]
# Usage
legacy = LegacyMonolith()
modern = ModernService()
facade = StranglerFacade(legacy, modern)


def send(facade: StranglerFacade, path: str) -> None:
    r = facade.handle(path)
    print(f'GET {path} -> {r.status} from {r.served_by}: {r.body}')


send(facade, '/products')  # 200 from legacy: 3 products
send(facade, '/orders/42')  # 200 from legacy: order 42, 2 items

facade.migrate('products')
send(facade, '/products')  # 200 from modern: 3 products

facade.migrate('orders')  # too early: the modern store has no orders yet
send(facade, '/orders/42')  # 404 from modern: order 42 not found
facade.rollback('orders')
send(facade, '/orders/42')  # 200 from legacy again

copy_orders(legacy, modern)  # 1 order copied
facade.migrate('orders')
send(facade, '/orders/42')  # 200 from modern: order 42, 2 items

facade.retire_legacy()  # refused: invoices still routed to legacy
facade.migrate('invoices')
send(facade, '/invoices/42')  # 200 from modern: invoice for order 42: 2 lines
facade.retire_legacy()  # succeeds: nothing routes to legacy any more

print(f'calls: legacy {legacy.calls}, modern {modern.calls}')  # legacy 3, modern 4
# [/usage]
