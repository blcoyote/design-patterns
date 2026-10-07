from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Request:
    path: str
    token: str | None


@dataclass(frozen=True)
class Response:
    status: int


Handler = Callable[[Request], Response]
# A middleware receives the request and the rest of the pipeline as next_handler.
Middleware = Callable[[Request, Handler], Response]


# [pipeline]
def _wrap(middleware: Middleware, next_handler: Handler) -> Handler:
    # A helper, so each wrapper keeps its own middleware and next_handler
    # instead of sharing the loop variables.
    return lambda req: middleware(req, next_handler)


# Wraps the handler in the middlewares from last to first, so the first one in
# the list is the outermost: it sees the request first and the response last.
def pipeline(middlewares: list[Middleware], handler: Handler) -> Handler:
    result = handler
    for middleware in reversed(middlewares):
        result = _wrap(middleware, result)
    return result
# [/pipeline]


# [logging]
def logging(req: Request, next_handler: Handler) -> Response:
    print(f'log: -> {req.path}')
    res = next_handler(req)
    # [logAfter]
    # Code after next_handler() runs on the way back out, once the response exists.
    print(f'log: <- {res.status}')
    # [/logAfter]
    return res
# [/logging]


# [auth]
def auth(req: Request, next_handler: Handler) -> Response:
    # [authReject]
    # Short-circuit: answer here and never call next_handler(), so nothing deeper runs.
    if req.token is None:
        print('auth: no token, rejected')
        return Response(401)
    # [/authReject]
    print('auth: token accepted')
    return next_handler(req)
# [/auth]


# [cache]
# Keyed by path only, so it must sit behind auth: it does not know who is asking.
def make_cache() -> Middleware:
    stored: dict[str, Response] = {}

    def cache(req: Request, next_handler: Handler) -> Response:
        # [cacheHit]
        hit = stored.get(req.path)
        if hit is not None:
            print(f'cache: hit {req.path}')
            return hit
        # [/cacheHit]
        print(f'cache: miss {req.path}')
        res = next_handler(req)
        if res.status == 200:
            stored[req.path] = res
            print(f'cache: stored {req.path}')
        return res

    return cache
# [/cache]


# [handler]
def handler(req: Request) -> Response:
    print(f'handler: building {req.path}')
    return Response(200)
# [/handler]


# [client]
def send(app: Handler, token: str | None) -> None:
    res = app(Request('/report', token))
    print(f'=> {res.status}')


app = pipeline([logging, auth, make_cache()], handler)

send(app, 't-1')  # first request: every middleware runs, the handler builds the report
# log: -> /report
# auth: token accepted
# cache: miss /report
# handler: building /report
# cache: stored /report
# log: <- 200
# => 200

send(app, 't-1')  # second request: the cache answers, so the handler never runs
# log: -> /report
# auth: token accepted
# cache: hit /report
# log: <- 200
# => 200

send(app, None)  # no token: auth rejects, so the cache and handler never run
# log: -> /report
# auth: no token, rejected
# log: <- 401
# => 401

# [reorder]
# The same pieces in a different order: the cache now runs before auth.
unsafe = pipeline([logging, make_cache(), auth], handler)
# [/reorder]

send(unsafe, 't-1')  # a signed-in request warms the cache
# log: -> /report
# cache: miss /report
# auth: token accepted
# handler: building /report
# cache: stored /report
# log: <- 200
# => 200

send(unsafe, None)  # an anonymous request is answered from the cache: auth never ran
# log: -> /report
# cache: hit /report
# log: <- 200
# => 200
# [/client]
