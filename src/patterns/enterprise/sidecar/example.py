from collections.abc import Mapping
from dataclasses import dataclass, replace
from typing import Protocol


# [http]
@dataclass(frozen=True)
class HttpRequest:
    method: str
    to: str
    path: str
    headers: Mapping[str, str]


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: str


class Outbound(Protocol):
    """Anything that can carry a request to another service."""

    def send(self, request: HttpRequest) -> HttpResponse: ...


class Service(Protocol):
    """A service that can answer a request."""

    def handle(self, request: HttpRequest) -> HttpResponse: ...


# Returns a NEW request with a copied header dict; the original is unchanged.
def with_header(request: HttpRequest, name: str, value: str) -> HttpRequest:
    return replace(request, headers={**request.headers, name: value})
# [/http]


# [inventory]
class InventoryService:
    def __init__(self) -> None:
        self.calls = 0
        self._fail_next = False

    # Scripted failure: exactly the next call answers 503.
    def fail_next_call(self) -> None:
        self._fail_next = True
        print('[inventory] next call will fail with 503')

    def handle(self, request: HttpRequest) -> HttpResponse:
        self.calls += 1
        if 'x-client-identity' not in request.headers:
            return HttpResponse(401, 'no client identity')
        if self._fail_next:
            self._fail_next = False
            return HttpResponse(503, 'busy')
        sku = request.path[len('/stock/'):]
        return HttpResponse(200, f'{sku}: 3 in stock')
# [/inventory]


# [network]
# Stands in for the cluster network: a lookup by service name, then a method call.
class Network:
    def __init__(self) -> None:
        self._services: dict[str, Service] = {}

    def register(self, name: str, service: Service) -> None:
        self._services[name] = service

    def send(self, request: HttpRequest) -> HttpResponse:
        service = self._services.get(request.to)
        if service is None:
            raise RuntimeError(f'unknown service: {request.to}')
        return service.handle(request)
# [/network]


# [sidecar]
# The process boundary is simulated: the app and this sidecar are two objects in one
# process, and the "network" between them is a method call. A real sidecar is a
# separate process or container deployed with each service instance.
#
# The x-client-identity header stands in for mutual TLS. A real sidecar presents a
# certificate on an encrypted connection; here it is a plain header, and inventory
# only checks that the header is present, which is not secure.
class Sidecar:
    def __init__(self, service_name: str, upstream: Outbound, max_retries: int) -> None:
        self.requests = 0
        self.attempts = 0
        self.retries = 0
        self.failures = 0
        self._service_name = service_name
        self._upstream = upstream
        self._max_retries = max_retries

    def send(self, request: HttpRequest) -> HttpResponse:
        self.requests += 1
        outgoing = with_header(request, 'x-client-identity', self._service_name)

        # Retrying is safe here only because the call is an idempotent GET, and only a
        # 503 is retried. Other statuses, such as 401, are returned as they are.
        attempts_here = 0
        while True:  # Python has no do/while: the body always runs at least once
            attempts_here += 1
            self.attempts += 1
            response = self._upstream.send(outgoing)
            if response.status != 503 or attempts_here > self._max_retries:
                break

        self.retries += attempts_here - 1
        if response.status >= 400:
            self.failures += 1
        print(
            f'[sidecar {self._service_name}] {request.method} {request.to}{request.path} '
            f'-> {response.status} (attempts {attempts_here})'
        )
        return response

    def set_max_retries(self, n: int) -> None:
        self._max_retries = n
        print(f'[sidecar {self._service_name}] config reloaded: max retries {n}')
# [/sidecar]


# [app]
# There is no identity, retry or metrics code here: that all lives in the sidecar.
# Real meshes usually redirect the app's traffic to the sidecar transparently (for
# example with iptables rules), so the app code does not change at all. Here the
# sidecar is handed in explicitly as an Outbound.
class OrderService:
    def __init__(self, outbound: Outbound) -> None:
        self._outbound = outbound

    def check_stock(self, sku: str) -> HttpResponse:
        response = self._outbound.send(
            HttpRequest(method='GET', to='inventory', path=f'/stock/{sku}', headers={})
        )
        print(f'[orders] stock {sku}: {response.status} {response.body}')
        return response
# [/app]


# [usage]
# Usage
inventory = InventoryService()
network = Network()
network.register('inventory', inventory)

sidecar = Sidecar('orders', network, 1)
orders = OrderService(sidecar)

orders.check_stock('sku-1')

inventory.fail_next_call()
orders.check_stock('sku-1')  # the sidecar retries; the app sees only the 200

print('[usage] same app code wired straight to the network, bypassing the sidecar')
direct = OrderService(network)
direct.check_stock('sku-1')

sidecar.set_max_retries(0)
inventory.fail_next_call()
orders.check_stock('sku-1')

print(
    f'sidecar metrics: requests {sidecar.requests}, attempts {sidecar.attempts}, '
    f'retries {sidecar.retries}, failures {sidecar.failures}'
)
print(f'inventory calls: {inventory.calls}')
# [/usage]
