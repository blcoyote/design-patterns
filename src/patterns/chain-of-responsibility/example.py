import time
from dataclasses import dataclass


@dataclass
class HttpRequest:
    path: str
    client_id: str
    token: str | None = None
    body: object = None


@dataclass
class HttpResponse:
    status: int
    body: str


# [handler]
class Handler:
    def __init__(self) -> None:
        self._next: Handler | None = None

    def set_next(self, handler: 'Handler') -> 'Handler':
        self._next = handler
        return handler

    def handle(self, req: HttpRequest) -> HttpResponse:
        if self._next:
            return self._next.handle(req)
        return HttpResponse(404, 'No handler matched')
# [/handler]


# [authHandler]
class AuthHandler(Handler):
    # [auth]
    def handle(self, req: HttpRequest) -> HttpResponse:
        if not req.token or req.token == 'expired':
            return HttpResponse(401, 'Unauthorized')
        return super().handle(req)  # not my problem — pass it on
    # [/auth]
# [/authHandler]


# [rateLimitHandler]
class RateLimitHandler(Handler):
    _WINDOW_MS = 60_000
    _LIMIT = 100

    def __init__(self) -> None:
        super().__init__()
        # Each client gets its own fixed window — one client going over the cap
        # never affects any other client's count.
        self._windows: dict[str, dict[str, float]] = {}

    # [rateLimit]
    def handle(self, req: HttpRequest) -> HttpResponse:
        now = time.monotonic() * 1000
        window = self._windows.get(req.client_id)
        if not window or now - window['window_start'] >= self._WINDOW_MS:
            window = {'window_start': now, 'count': 0}
            self._windows[req.client_id] = window
        window['count'] += 1
        if window['count'] > self._LIMIT:
            return HttpResponse(429, 'Too Many Requests')
        return super().handle(req)
    # [/rateLimit]
# [/rateLimitHandler]


# [validationHandler]
class ValidationHandler(Handler):
    # [validation]
    def handle(self, req: HttpRequest) -> HttpResponse:
        if req.body is not None and not isinstance(req.body, dict):
            return HttpResponse(422, 'Invalid payload')
        return super().handle(req)  # no body to check, or it already looks fine
    # [/validation]
# [/validationHandler]


# [controller]
class Controller(Handler):
    def handle(self, req: HttpRequest) -> HttpResponse:
        # The terminal link: it never calls next, it just answers.
        return HttpResponse(200, f'handled {req.path}')
# [/controller]


# [entry]
chain = AuthHandler()
chain.set_next(RateLimitHandler()).set_next(ValidationHandler()).set_next(Controller())

print(chain.handle(HttpRequest(path='/orders/42', client_id='client-1', token='abc123')))  # status=200, body='handled /orders/42'
print(chain.handle(HttpRequest(path='/orders/42', client_id='client-1', token='expired')))  # status=401, ... — stops at AuthHandler
# [/entry]
