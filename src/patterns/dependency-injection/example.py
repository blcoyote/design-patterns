from dataclasses import dataclass
from typing import Callable, Protocol, TypeVar, cast


# [emailSender]
class EmailSender(Protocol):
    def send(self, to: str, subject: str, body: str) -> None: ...
# [/emailSender]


# [smtpEmailSender]
class SmtpEmailSender:
    def send(self, to: str, subject: str, body: str) -> None:
        print(f"SMTP -> {to}: {subject}")
# [/smtpEmailSender]


# [config]
class Config:
    def __init__(self, db_url: str = "postgres://localhost/orders") -> None:
        self.db_url = db_url
# [/config]


# [orderRepository]
class OrderRepository(Protocol):
    def save(self, order_id: str) -> None: ...
    def find_by_id(self, order_id: str) -> object | None: ...
# [/orderRepository]


# [sqlOrderRepository]
class SqlOrderRepository:
    def __init__(self, config: Config) -> None:
        self._config = config

    def save(self, order_id: str) -> None:
        print(f"INSERT INTO orders ({self._config.db_url}) ...")

    def find_by_id(self, order_id: str) -> object | None:
        print(f"SELECT * FROM orders ({self._config.db_url}) WHERE id = {order_id}")
        return None
# [/sqlOrderRepository]


# [orderService]
class OrderService:
    def __init__(self, repository: OrderRepository, email_sender: EmailSender) -> None:
        self._repository = repository
        self._email_sender = email_sender

    def place_order(self, order_id: str, customer_email: str) -> None:
        self._repository.save(order_id)
        self._email_sender.send(customer_email, "Order placed", f"Order {order_id} is confirmed.")
# [/orderService]


# [orderController]
class OrderController:
    def __init__(self, service: OrderService) -> None:
        self._service = service

    def handle(self, order_id: str, customer_email: str) -> None:
        self._service.place_order(order_id, customer_email)
# [/orderController]


# [container]
# A container is nothing magical: a map of providers (each listing the keys it
# needs) plus a resolve() that builds those dependencies first, recursively,
# and caches every result as a singleton. Real containers (Spring, ASP.NET
# Core's IServiceCollection, InversifyJS) also offer transient (new instance
# every resolve) and scoped (one instance per request/operation) lifetimes;
# this toy container only ever does singleton.
T = TypeVar("T")


@dataclass
class _Provider:
    deps: list[str]
    create: Callable[..., object]


class Container:
    def __init__(self) -> None:
        self._providers: dict[str, _Provider] = {}
        self._singletons: dict[str, object] = {}

    def register(self, key: str, deps: list[str], create: Callable[..., object]) -> None:
        self._providers[key] = _Provider(deps, create)

    # cls plays the role of TS's resolve<T>(): it only tells the type checker
    # what comes back — the registered provider decides what is actually built.
    def resolve(self, key: str, cls: type[T]) -> T:
        if key not in self._singletons:
            provider = self._providers.get(key)
            if provider is None:
                raise ValueError("No provider registered for " + key)
            # Build whatever it needs first (recursively), then construct it.
            args = [self.resolve(dep, object) for dep in provider.deps]
            self._singletons[key] = provider.create(*args)
        return cast(T, self._singletons[key])
# [/container]


# [usage]
# This block — the only place that touches Container directly — is the real
# composition root: it configures the graph once, then hands off to plain
# objects that never see the container again.
container = Container()

container.register("config", [], lambda: Config())
container.register("orderRepository", ["config"], lambda config: SqlOrderRepository(config))
container.register("emailSender", [], lambda: SmtpEmailSender())
container.register("orderService", ["orderRepository", "emailSender"], lambda repo, email: OrderService(repo, email))
container.register("orderController", ["orderService"], lambda service: OrderController(service))

# Ask only for the root — the container works out the rest of the graph.
# Note: OrderController and OrderService never call container.resolve()
# themselves — if they did, that would be the Service Locator pattern, not DI.
order_controller = container.resolve("orderController", OrderController)
order_controller.handle("A-1001", "ada@example.com")
# [/usage]


# [test]
# Tests don't need the container at all — just construct OrderService by hand
# with fakes for both of its dependencies:
class FakeOrderRepository:
    def __init__(self) -> None:
        self.saved: list[str] = []

    def save(self, order_id: str) -> None:
        self.saved.append(order_id)

    def find_by_id(self, order_id: str) -> object | None:
        return None


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[str] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append(f"{to}: {subject}")


fake_repo = FakeOrderRepository()
service = OrderService(fake_repo, FakeEmailSender())
service.place_order("A-1001", "ada@example.com")
# [/test]
