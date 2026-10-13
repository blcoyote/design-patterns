// [http]
interface HttpRequest {
  readonly method: string;
  readonly to: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
}

interface HttpResponse {
  readonly status: number;
  readonly body: string;
}

/** Anything that can carry a request to another service. */
interface Outbound {
  send(request: HttpRequest): HttpResponse;
}

/** A service that can answer a request. */
interface Service {
  handle(request: HttpRequest): HttpResponse;
}

// Returns a NEW request with a copied header object; the original is unchanged.
function withHeader(request: HttpRequest, name: string, value: string): HttpRequest {
  return { ...request, headers: { ...request.headers, [name]: value } };
}
// [/http]

// [inventory]
class InventoryService implements Service {
  calls = 0;
  private failNext = false;

  // Scripted failure: exactly the next call answers 503.
  failNextCall(): void {
    this.failNext = true;
    console.log("[inventory] next call will fail with 503");
  }

  handle(request: HttpRequest): HttpResponse {
    this.calls++;
    if (!("x-client-identity" in request.headers)) {
      return { status: 401, body: "no client identity" };
    }
    if (this.failNext) {
      this.failNext = false;
      return { status: 503, body: "busy" };
    }
    const sku = request.path.slice("/stock/".length);
    return { status: 200, body: `${sku}: 3 in stock` };
  }
}
// [/inventory]

// [network]
// Stands in for the cluster network: a lookup by service name, then a method call.
class Network implements Outbound {
  private readonly services = new Map<string, Service>();

  register(name: string, service: Service): void {
    this.services.set(name, service);
  }

  send(request: HttpRequest): HttpResponse {
    const service = this.services.get(request.to);
    if (service === undefined) {
      throw new Error(`unknown service: ${request.to}`);
    }
    return service.handle(request);
  }
}
// [/network]

// [sidecar]
// The process boundary is simulated: the app and this sidecar are two objects in one
// process, and the "network" between them is a method call. A real sidecar is a
// separate process or container deployed with each service instance.
//
// The x-client-identity header stands in for mutual TLS. A real sidecar presents a
// certificate on an encrypted connection; here it is a plain header, and inventory
// only checks that the header is present, which is not secure.
class Sidecar implements Outbound {
  requests = 0;
  attempts = 0;
  retries = 0;
  failures = 0;

  constructor(
    private readonly serviceName: string,
    private readonly upstream: Outbound,
    private maxRetries: number,
  ) {}

  send(request: HttpRequest): HttpResponse {
    this.requests++;
    const outgoing = withHeader(request, "x-client-identity", this.serviceName);

    // Retrying is safe here only because the call is an idempotent GET, and only a
    // 503 is retried. Other statuses, such as 401, are returned as they are.
    let attemptsHere = 0;
    let response: HttpResponse;
    do {
      attemptsHere++;
      this.attempts++;
      response = this.upstream.send(outgoing);
    } while (response.status === 503 && attemptsHere <= this.maxRetries);

    this.retries += attemptsHere - 1;
    if (response.status >= 400) {
      this.failures++;
    }
    console.log(
      `[sidecar ${this.serviceName}] ${request.method} ${request.to}${request.path} -> ${response.status} (attempts ${attemptsHere})`,
    );
    return response;
  }

  setMaxRetries(n: number): void {
    this.maxRetries = n;
    console.log(`[sidecar ${this.serviceName}] config reloaded: max retries ${n}`);
  }
}
// [/sidecar]

// [app]
// There is no identity, retry or metrics code here: that all lives in the sidecar.
// Real meshes usually redirect the app's traffic to the sidecar transparently (for
// example with iptables rules), so the app code does not change at all. Here the
// sidecar is handed in explicitly as an Outbound.
class OrderService {
  constructor(private readonly outbound: Outbound) {}

  checkStock(sku: string): HttpResponse {
    const response = this.outbound.send({
      method: "GET",
      to: "inventory",
      path: `/stock/${sku}`,
      headers: {},
    });
    console.log(`[orders] stock ${sku}: ${response.status} ${response.body}`);
    return response;
  }
}
// [/app]

// [usage]
// Usage
const inventory = new InventoryService();
const network = new Network();
network.register("inventory", inventory);

const sidecar = new Sidecar("orders", network, 1);
const orders = new OrderService(sidecar);

orders.checkStock("sku-1");

inventory.failNextCall();
orders.checkStock("sku-1"); // the sidecar retries; the app sees only the 200

console.log("[usage] same app code wired straight to the network, bypassing the sidecar");
const direct = new OrderService(network);
direct.checkStock("sku-1");

sidecar.setMaxRetries(0);
inventory.failNextCall();
orders.checkStock("sku-1");

console.log(
  `sidecar metrics: requests ${sidecar.requests}, attempts ${sidecar.attempts}, retries ${sidecar.retries}, failures ${sidecar.failures}`,
);
console.log(`inventory calls: ${inventory.calls}`);
// [/usage]
