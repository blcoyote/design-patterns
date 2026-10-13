// [http]
/** What a client sends to the gateway: plain data, no network involved. */
interface GatewayRequest {
  readonly token: string;
  readonly method: string;
  readonly path: string;
}

interface GatewayResponse {
  readonly status: number;
  readonly body: string;
}

/** A route handler gets the authenticated user id and builds the response. */
type RouteHandler = (userId: string) => GatewayResponse;
// [/http]

// [services]
interface Profile {
  readonly name: string;
  readonly email: string;
}

interface OrderSummary {
  readonly id: string;
  readonly items: number;
}

// The services trust the user id the gateway hands them. Real systems pass a
// signed token (e.g. a JWT) or secure the gateway-to-service hop (e.g. mTLS), so
// a caller that bypasses the gateway cannot claim to be someone else.
class UserService {
  calls = 0; // counted first thing in profile(), so the usage can show who was reached
  private readonly profiles = new Map<string, Profile>([
    ["alice", { name: "Alice", email: "alice@example.com" }],
    ["bob", { name: "Bob", email: "bob@example.com" }],
  ]);

  profile(userId: string): Profile {
    this.calls++;
    const found = this.profiles.get(userId);
    if (found === undefined) {
      throw new Error(`unknown user ${userId}`); // the gateway only passes ids it authenticated
    }
    return found;
  }
}

class OrderService {
  calls = 0; // counted first thing in recent()
  private readonly orders = new Map<string, OrderSummary[]>([
    [
      "alice",
      [
        { id: "order-1", items: 2 },
        { id: "order-2", items: 3 },
      ],
    ],
  ]);

  recent(userId: string): OrderSummary[] {
    this.calls++;
    return this.orders.get(userId) ?? []; // bob has no entry: no orders
  }
}
// [/services]

// [authenticator]
class Authenticator {
  private readonly users = new Map<string, string>([
    ["token-alice", "alice"],
    ["token-bob", "bob"],
  ]);

  /** The user id for a known token, or undefined for an unknown one. */
  authenticate(token: string): string | undefined {
    return this.users.get(token);
  }
}
// [/authenticator]

// [rateLimiter]
// A fixed-window counter per user. The window is advanced by an explicit
// nextWindow() call instead of a clock, so the example stays deterministic. Real
// limiters often use sliding windows or token buckets, and keep their counters in
// shared storage (e.g. Redis) when the gateway runs as several instances.
class FixedWindowRateLimiter {
  private readonly counts = new Map<string, number>();

  constructor(readonly limit: number) {}

  /** Counts the request and returns true while the user is under the limit. */
  tryAcquire(userId: string): boolean {
    const used = this.counts.get(userId) ?? 0;
    if (used >= this.limit) {
      return false; // rejected requests are not counted
    }
    this.counts.set(userId, used + 1);
    return true;
  }

  used(userId: string): number {
    return this.counts.get(userId) ?? 0;
  }

  /** Starts a new window: every user's count goes back to zero. */
  nextWindow(): void {
    this.counts.clear();
  }
}
// [/rateLimiter]

// [aggregation]
// Aggregation: one client call becomes two service calls, composed into a single
// response. This handler is a Facade over the two services.
function homeRoute(users: UserService, orders: OrderService): RouteHandler {
  return (userId) => {
    const profile = users.profile(userId);
    const recent = orders.recent(userId);
    return { status: 200, body: `${profile.name}: ${recent.length} orders` };
  };
}
// [/aggregation]

// [routes]
// The route table: the exact string "<METHOD> <path>" maps to a handler.
function createRoutes(users: UserService, orders: OrderService): Map<string, RouteHandler> {
  return new Map<string, RouteHandler>([
    [
      "GET /profile",
      (userId) => {
        const profile = users.profile(userId);
        return { status: 200, body: `${profile.name} <${profile.email}>` };
      },
    ],
    [
      "GET /orders",
      (userId) => {
        const recent = orders.recent(userId);
        const body =
          recent.length === 0
            ? "no orders"
            : recent.map((order) => `${order.id} (${order.items} items)`).join(", ");
        return { status: 200, body };
      },
    ],
    ["GET /home", homeRoute(users, orders)],
  ]);
}
// [/routes]

// [gateway]
// A real gateway (Kong, Amazon API Gateway, YARP, ...) is a separate network
// process configured with routes and plugins. Here it is an in-process class and
// the requests are plain objects, so the example runs the same in every language.
// The checks below are a fixed sequence; real gateways usually build them as a
// configurable filter chain, which is the Middleware pattern.
class ApiGateway {
  constructor(
    private readonly authenticator: Authenticator,
    private readonly limiter: FixedWindowRateLimiter,
    private readonly routes: Map<string, RouteHandler>,
  ) {}

  handle(request: GatewayRequest): GatewayResponse {
    const userId = this.authenticator.authenticate(request.token);
    if (userId === undefined) {
      return { status: 401, body: "unknown token" }; // nothing else runs
    }
    if (!this.limiter.tryAcquire(userId)) {
      return {
        status: 429,
        body: `rate limit: ${this.limiter.limit} requests per window`,
      };
    }
    // Limiting happens before routing, so a request with no route still counts.
    const route = this.routes.get(`${request.method} ${request.path}`);
    if (route === undefined) {
      return { status: 404, body: `no route for ${request.method} ${request.path}` };
    }
    return route(userId);
  }

  nextWindow(): void {
    this.limiter.nextWindow();
  }
}
// [/gateway]

// [usage]
const users = new UserService();
const orders = new OrderService();
const limiter = new FixedWindowRateLimiter(3);
const gateway = new ApiGateway(new Authenticator(), limiter, createRoutes(users, orders));

function send(gateway: ApiGateway, token: string, method: string, path: string): void {
  const response = gateway.handle({ token, method, path });
  console.log(`${method} ${path} [${token}] -> ${response.status} ${response.body}`);
}

send(gateway, "token-alice", "GET", "/profile"); // 200 Alice <alice@example.com>
send(gateway, "token-alice", "GET", "/orders"); // 200 order-1 (2 items), order-2 (3 items)
send(gateway, "token-alice", "GET", "/home"); // 200 Alice: 2 orders (two service calls)
send(gateway, "token-mallory", "GET", "/orders"); // 401: no limiter check, no service call
send(gateway, "token-alice", "GET", "/profile"); // 429: alice has used 3 of 3, not counted
console.log("[gateway] next window");
gateway.nextWindow();
send(gateway, "token-alice", "GET", "/admin"); // 404, but it still counts: alice 1/3
send(gateway, "token-bob", "GET", "/orders"); // 200 no orders: bob is counted separately from alice

console.log(`backend calls: users ${users.calls}, orders ${orders.calls}`); // users 2, orders 3
console.log(
  `rate limit: alice ${limiter.used("alice")}/${limiter.limit}, bob ${limiter.used("bob")}/${limiter.limit}`,
); // alice 1/3, bob 1/3
// [/usage]
