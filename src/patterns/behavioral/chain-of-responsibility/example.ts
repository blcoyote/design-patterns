interface HttpRequest {
  path: string
  clientId: string
  token?: string
  body?: unknown
}

interface HttpResponse {
  status: number
  body: string
}

// [handler]
abstract class Handler {
  private next: Handler | null = null

  setNext(handler: Handler): Handler {
    this.next = handler
    return handler
  }

  handle(req: HttpRequest): HttpResponse {
    if (this.next) return this.next.handle(req)
    return { status: 404, body: 'No handler matched' }
  }
}
// [/handler]

// [authHandler]
class AuthHandler extends Handler {
  // [auth]
  handle(req: HttpRequest): HttpResponse {
    if (!req.token || req.token === 'expired') {
      return { status: 401, body: 'Unauthorized' }
    }
    return super.handle(req) // not my problem — pass it on
  }
  // [/auth]
}
// [/authHandler]

// [rateLimitHandler]
class RateLimitHandler extends Handler {
  private static readonly WINDOW_MS = 60_000
  private static readonly LIMIT = 100

  // Each client gets its own fixed window — one client going over the cap
  // never affects any other client's count.
  private readonly windows = new Map<string, { windowStart: number; count: number }>()

  // [rateLimit]
  handle(req: HttpRequest): HttpResponse {
    const now = Date.now()
    let window = this.windows.get(req.clientId)
    if (!window || now - window.windowStart >= RateLimitHandler.WINDOW_MS) {
      window = { windowStart: now, count: 0 }
      this.windows.set(req.clientId, window)
    }
    window.count++
    if (window.count > RateLimitHandler.LIMIT) {
      return { status: 429, body: 'Too Many Requests' }
    }
    return super.handle(req)
  }
  // [/rateLimit]
}
// [/rateLimitHandler]

// [validationHandler]
class ValidationHandler extends Handler {
  // [validation]
  handle(req: HttpRequest): HttpResponse {
    if (req.body !== undefined && (req.body === null || typeof req.body !== 'object')) {
      return { status: 422, body: 'Invalid payload' }
    }
    return super.handle(req) // no body to check, or it already looks fine
  }
  // [/validation]
}
// [/validationHandler]

// [controller]
class Controller extends Handler {
  handle(req: HttpRequest): HttpResponse {
    // The terminal link: it never calls next, it just answers.
    return { status: 200, body: `handled ${req.path}` }
  }
}
// [/controller]

// [entry]
const chain = new AuthHandler()
chain.setNext(new RateLimitHandler()).setNext(new ValidationHandler()).setNext(new Controller())

chain.handle({ path: '/orders/42', clientId: 'client-1', token: 'abc123' }) // { status: 200, body: 'handled /orders/42' }
chain.handle({ path: '/orders/42', clientId: 'client-1', token: 'expired' }) // { status: 401, ... } — stops at AuthHandler
// [/entry]
