// [emailSender]
interface EmailSender {
  send(to: string, subject: string, body: string): void
}
// [/emailSender]

// [smtpEmailSender]
class SmtpEmailSender implements EmailSender {
  send(to: string, subject: string, body: string) {
    console.log(`SMTP -> ${to}: ${subject}`)
  }
}
// [/smtpEmailSender]

// [config]
class Config {
  constructor(public readonly dbUrl: string = 'postgres://localhost/orders') {}
}
// [/config]

// [orderRepository]
interface OrderRepository {
  save(orderId: string): void
  findById(orderId: string): unknown
}
// [/orderRepository]

// [sqlOrderRepository]
class SqlOrderRepository implements OrderRepository {
  constructor(private config: Config) {}

  save(orderId: string) {
    console.log(`INSERT INTO orders (${this.config.dbUrl}) ...`)
  }
  findById(orderId: string) {
    console.log(`SELECT * FROM orders (${this.config.dbUrl}) WHERE id = ${orderId}`)
    return null
  }
}
// [/sqlOrderRepository]

// [orderService]
class OrderService {
  constructor(
    private repository: OrderRepository,
    private emailSender: EmailSender,
  ) {}

  placeOrder(orderId: string, customerEmail: string) {
    this.repository.save(orderId)
    this.emailSender.send(customerEmail, 'Order placed', `Order ${orderId} is confirmed.`)
  }
}
// [/orderService]

// [orderController]
class OrderController {
  constructor(private service: OrderService) {}

  handle(orderId: string, customerEmail: string) {
    this.service.placeOrder(orderId, customerEmail)
  }
}
// [/orderController]

// [container]
// A container is nothing magical: a map of providers (each listing the keys it
// needs) plus a resolve() that builds those dependencies first, recursively,
// and caches every result as a singleton. Real containers (Spring, ASP.NET
// Core's IServiceCollection, InversifyJS) also offer transient (new instance
// every resolve) and scoped (one instance per request/operation) lifetimes;
// this toy container only ever does singleton.
class Container {
  private providers = new Map<string, { deps: string[]; create: (...deps: any[]) => unknown }>()
  private singletons = new Map<string, unknown>()

  register(key: string, deps: string[], create: (...deps: any[]) => unknown) {
    this.providers.set(key, { deps, create })
  }

  resolve<T>(key: string): T {
    if (!this.singletons.has(key)) {
      const provider = this.providers.get(key)
      if (!provider) throw new Error('No provider registered for ' + key)
      // Build whatever it needs first (recursively), then construct it.
      const args = provider.deps.map((dep) => this.resolve(dep))
      this.singletons.set(key, provider.create(...args))
    }
    return this.singletons.get(key) as T
  }
}
// [/container]

// [usage]
// This block — the only place that touches Container directly — is the real
// composition root: it configures the graph once, then hands off to plain
// objects that never see the container again.
const container = new Container()

container.register('config', [], () => new Config())
container.register('orderRepository', ['config'], (config: Config) => new SqlOrderRepository(config))
container.register('emailSender', [], () => new SmtpEmailSender())
container.register('orderService', ['orderRepository', 'emailSender'], (repo: OrderRepository, email: EmailSender) => new OrderService(repo, email))
container.register('orderController', ['orderService'], (service: OrderService) => new OrderController(service))

// Ask only for the root — the container works out the rest of the graph.
// Note: OrderController and OrderService never call container.resolve()
// themselves — if they did, that would be the Service Locator pattern, not DI.
const orderController = container.resolve<OrderController>('orderController')
orderController.handle('A-1001', 'ada@example.com')
// [/usage]

// [test]
// Tests don't need the container at all — just construct OrderService by hand
// with fakes for both of its dependencies:
class FakeOrderRepository implements OrderRepository {
  saved: string[] = []
  save(orderId: string) {
    this.saved.push(orderId)
  }
  findById() {
    return null
  }
}
class FakeEmailSender implements EmailSender {
  sent: string[] = []
  send(to: string, subject: string) {
    this.sent.push(`${to}: ${subject}`)
  }
}

const fakeRepo = new FakeOrderRepository()
const service = new OrderService(fakeRepo, new FakeEmailSender())
service.placeOrder('A-1001', 'ada@example.com')
// [/test]
