import type { PatternDefinition } from '@/types/pattern'
import { DependencyInjectionVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'dependency-injection',
  name: 'Dependency Injection',
  category: 'architectural',
  order: 1,
  summary: 'Hand objects their dependencies from the outside instead of letting them construct their own.',
  intent:
    'Separate the construction of an object’s dependencies from its own logic, so a class receives what it needs through its constructor instead of creating it internally.',
  problem:
    'OrderService needs a database repository and a way to send email. If it calls new OrderRepository() and new SmtpEmailSender() itself, it is now hard-wired to those concrete classes and to however many dependencies they in turn require. Testing OrderService means testing the real repository and the real mailer too, and swapping either one means editing OrderService’s source.',
  solution:
    'Classes declare what they need as constructor parameters, typed as interfaces where it matters, and never instantiate those parameters themselves. A container — or just a few lines of composition code — builds the dependency graph bottom-up, leaves first, and passes each finished instance into the constructor of whatever needs it, until the object the application actually wants is fully wired.',
  analogy:
    'A car factory does not have the engine build its own pistons: pistons, engine and chassis are built separately and assembled in order, each station handed exactly the finished parts it needs.',
  whenToUse: [
    'A class’s dependencies have dependencies of their own, and wiring them by hand is repetitive or error-prone.',
    'You want to substitute a fake or mock implementation in tests without touching the class under test.',
    'Different environments (dev, test, prod) need different concrete implementations behind the same interface.',
    'You want construction logic centralized instead of scattered across every class that happens to need an object.',
  ],
  pros: [
    'Classes depend on abstractions, not concrete classes — implementations are easy to swap.',
    'Testing is trivial: hand the class under test a fake or mock instead of the real dependency.',
    'Construction logic lives in one place instead of being duplicated across every consumer.',
  ],
  cons: [
    'Adds indirection — instead of following a chain of `new` calls you now follow a container.',
    'Misconfigured wiring (a missing registration, a lifetime mismatch) only fails at resolve time, not compile time.',
    'Overkill for small scripts with only one or two straightforward dependencies.',
    'Passing the container itself into a class so it can call resolve() whenever it needs something is Service Locator, not Dependency Injection — it hides the dependency instead of declaring it.',
  ],
  realWorld: [
    'Angular and NestJS: constructor injection driven by decorators (@Injectable, @Inject)',
    'Spring Framework (Java): the ApplicationContext as the container',
    'ASP.NET Core: IServiceCollection / IServiceProvider built into the framework',
    'InversifyJS and tsyringe: lightweight containers for plain TypeScript/Node apps',
  ],
  related: ['singleton', 'factory-method', 'strategy', 'repository'],

  participants: [
    {
      id: 'container',
      label: 'Container',
      role: 'DI Container / Injector',
      kind: 'client',
      x: 110,
      y: 230,
      description:
        'Builds and wires every object in the graph at startup, leaves first. Nothing else in the app calls new on a dependency — only the container does. The startup code that configures and invokes it (see the usage snippet) is the real Composition Root.',
    },
    {
      id: 'orderController',
      label: 'OrderController',
      role: 'Root of the graph',
      kind: 'class',
      x: 430,
      y: 70,
      width: 170,
      description:
        'The object the application actually wants. Resolving it forces the container to build its entire dependency chain first.',
    },
    {
      id: 'orderService',
      label: 'OrderService',
      role: 'Service',
      kind: 'class',
      x: 430,
      y: 190,
      description:
        'Coordinates placing an order. Depends on OrderRepository and EmailSender, both received as constructor parameters instead of being constructed internally.',
    },
    {
      id: 'orderRepository',
      label: 'OrderRepository',
      role: 'Abstraction',
      kind: 'interface',
      x: 230,
      y: 300,
      width: 170,
      description: 'Declares save() and findById(). OrderService depends only on this interface, never on a concrete storage mechanism.',
    },
    {
      id: 'emailSender',
      label: 'EmailSender',
      role: 'Abstraction',
      kind: 'interface',
      x: 630,
      y: 300,
      description: 'Declares send(). OrderService depends only on this interface, never on a concrete mailer.',
    },
    {
      id: 'config',
      label: 'Config',
      role: 'Leaf dependency',
      kind: 'class',
      x: 230,
      y: 400,
      description: 'Holds configuration values such as connection strings. Has no dependencies of its own, so the container can build it first.',
    },
    {
      id: 'smtpEmailSender',
      label: 'SmtpEmailSender',
      role: 'Concrete implementation',
      kind: 'class',
      x: 630,
      y: 400,
      width: 170,
      description: 'Sends real email over SMTP — one of possibly several implementations of EmailSender the container could hand out.',
    },
    {
      id: 'sqlOrderRepository',
      label: 'SqlOrderRepository',
      role: 'Concrete implementation',
      kind: 'class',
      x: 110,
      y: 400,
      width: 170,
      description: 'Persists orders to SQL. Needs a Config, injected through its constructor rather than constructed internally — one of possibly several implementations of OrderRepository the container could hand out.',
    },
  ],

  relations: [
    {
      id: 'create-config',
      from: 'container',
      to: 'config',
      type: 'creates',
      label: 'new Config()',
      description: 'The container builds Config first — it has no dependencies of its own, so it can be the very first thing constructed.',
      code: 'config',
      bend: -10,
    },
    {
      id: 'create-repo',
      from: 'container',
      to: 'sqlOrderRepository',
      type: 'creates',
      label: 'new SqlOrderRepository()',
      description: 'Once Config exists, the container builds SqlOrderRepository and passes the Config instance straight into its constructor.',
      code: 'sqlOrderRepository',
      bend: 20,
    },
    {
      id: 'create-email',
      from: 'container',
      to: 'smtpEmailSender',
      type: 'creates',
      label: 'new SmtpEmailSender()',
      description: 'SmtpEmailSender is also a leaf, so the container can build it independently of the repository branch.',
      code: 'smtpEmailSender',
      bend: -30,
    },
    {
      id: 'create-service',
      from: 'container',
      to: 'orderService',
      type: 'creates',
      label: 'new OrderService(repo, email)',
      description: 'With both of its dependencies built, OrderService can now be constructed and wired to them.',
      code: 'orderService',
      bend: 35,
    },
    {
      id: 'create-controller',
      from: 'container',
      to: 'orderController',
      type: 'creates',
      label: 'new OrderController(service)',
      description: 'OrderController is built last, once everything beneath it already exists.',
      code: 'orderController',
      bend: -45,
    },
    {
      id: 'repo-holds-config',
      from: 'sqlOrderRepository',
      to: 'config',
      type: 'holds',
      label: 'config',
      description: 'SqlOrderRepository stores the Config instance it was handed; it never constructs one itself.',
      code: 'sqlOrderRepository',
    },
    {
      id: 'email-implements',
      from: 'smtpEmailSender',
      to: 'emailSender',
      type: 'implements',
      description: 'SmtpEmailSender implements the EmailSender interface — the only thing OrderService is allowed to know about it.',
    },
    {
      id: 'repo-implements',
      from: 'sqlOrderRepository',
      to: 'orderRepository',
      type: 'implements',
      description: 'SqlOrderRepository implements the OrderRepository interface — the only thing OrderService is allowed to know about it.',
      bend: 15,
    },
    {
      id: 'service-holds-repo',
      from: 'orderService',
      to: 'orderRepository',
      type: 'holds',
      label: 'repository',
      description: 'OrderService stores its repository only as OrderRepository — it has no idea SqlOrderRepository (or a fake) is behind it.',
      code: 'orderService',
      bend: 15,
    },
    {
      id: 'service-holds-email',
      from: 'orderService',
      to: 'emailSender',
      type: 'holds',
      label: 'emailSender',
      description: 'OrderService stores its mailer only as EmailSender — it has no idea SmtpEmailSender (or a fake) is behind it.',
      code: 'orderService',
      bend: -15,
    },
    {
      id: 'controller-holds-service',
      from: 'orderController',
      to: 'orderService',
      type: 'holds',
      label: 'service',
      description: 'OrderController stores the OrderService instance it was constructed with.',
      code: 'orderController',
    },
    {
      id: 'client-call',
      from: 'container',
      to: 'orderController',
      type: 'calls',
      label: 'handle()',
      description: 'Shown from the container for proximity, but it is application code — not the container — that calls handle() on the resolved OrderController, exactly like any other object. DI only changes how it was built, not how it is used.',
      code: 'usage',
      bend: -60,
    },
  ],

  steps: [
    {
      title: 'Resolve OrderController',
      description:
        'The app asks the container to resolve OrderController. The container looks up the provider registered for it, sees it needs an OrderService, and must build that first — and recursively, whatever OrderService needs.',
      highlight: ['container', 'orderController'],
      notes: { container: 'resolving OrderController' },
      code: 'container',
    },
    {
      title: 'Build the first leaf: Config',
      description: 'Config has no constructor dependencies, so the container builds it immediately and caches the instance.',
      highlight: ['container', 'create-config', 'config'],
      packets: [{ relation: 'create-config', label: 'new Config()' }],
      notes: { config: 'built ✓' },
      code: 'config',
    },
    {
      title: 'SqlOrderRepository is wired to it',
      description: 'The container builds SqlOrderRepository next — the registered implementation of OrderRepository — and the Config instance built a moment ago flies straight into its constructor slot.',
      highlight: ['create-repo', 'repo-holds-config', 'repo-implements', 'sqlOrderRepository', 'orderRepository'],
      packets: [
        { relation: 'create-repo', label: 'new SqlOrderRepository()' },
        { relation: 'repo-holds-config', label: 'config', reverse: true },
      ],
      notes: { config: 'built ✓', sqlOrderRepository: 'built ✓' },
      code: 'sqlOrderRepository',
    },
    {
      title: 'The other branch: SmtpEmailSender',
      description:
        'SmtpEmailSender is also a leaf. The container builds it independently of the repository branch — order between independent branches does not matter, only dependency order does.',
      highlight: ['create-email', 'email-implements', 'smtpEmailSender'],
      packets: [{ relation: 'create-email', label: 'new SmtpEmailSender()' }],
      notes: { config: 'built ✓', sqlOrderRepository: 'built ✓', smtpEmailSender: 'built ✓' },
      code: 'smtpEmailSender',
    },
    {
      title: 'OrderService receives both dependencies',
      description: 'Only now that an OrderRepository and an EmailSender exist can OrderService be constructed. Both instances fly into its constructor at once, each typed as the interface.',
      highlight: ['create-service', 'service-holds-repo', 'service-holds-email', 'orderService'],
      packets: [
        { relation: 'create-service', label: 'new OrderService()' },
        { relation: 'service-holds-repo', label: 'repository', reverse: true },
        { relation: 'service-holds-email', label: 'emailSender', reverse: true },
      ],
      notes: { sqlOrderRepository: 'built ✓', smtpEmailSender: 'built ✓', orderService: 'built ✓' },
      code: 'orderService',
    },
    {
      title: 'OrderController is wired last',
      description: 'The root of the graph is built last, once the one thing it needs — OrderService — is ready. The graph is now fully wired, bottom-up.',
      highlight: ['create-controller', 'controller-holds-service', 'orderController'],
      packets: [
        { relation: 'create-controller', label: 'new OrderController()' },
        { relation: 'controller-holds-service', label: 'service', reverse: true },
      ],
      notes: { orderService: 'built ✓', orderController: 'built ✓' },
      code: 'orderController',
    },
    {
      title: 'Business as usual',
      description: 'The application calls handle() on the resolved OrderController exactly as it would on any hand-built object. Nothing about using it reveals that a container built it.',
      highlight: ['container', 'client-call', 'orderController'],
      packets: [{ relation: 'client-call', label: 'handle()' }],
      notes: { orderController: 'built ✓' },
      code: 'usage',
    },
    {
      title: 'Tests skip the container entirely',
      description: 'A unit test just calls new OrderService(fakeRepo, new FakeEmailSender()) directly — no container involved. OrderService never notices the difference: it only ever depended on the OrderRepository and EmailSender interfaces.',
      highlight: ['service-holds-repo', 'service-holds-email', 'orderRepository', 'smtpEmailSender', 'emailSender'],
      notes: { orderService: 'wired by hand (test)' },
      code: 'test',
    },
  ],

  code: `
// [emailSender]
interface EmailSender {
  send(to: string, subject: string, body: string): void
}
// [/emailSender]

// [smtpEmailSender]
class SmtpEmailSender implements EmailSender {
  send(to: string, subject: string, body: string) {
    console.log(\`SMTP -> \${to}: \${subject}\`)
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
    console.log(\`INSERT INTO orders (\${this.config.dbUrl}) ...\`)
  }
  findById(orderId: string) {
    console.log(\`SELECT * FROM orders (\${this.config.dbUrl}) WHERE id = \${orderId}\`)
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
    this.emailSender.send(customerEmail, 'Order placed', \`Order \${orderId} is confirmed.\`)
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
    this.sent.push(\`\${to}: \${subject}\`)
  }
}

const fakeRepo = new FakeOrderRepository()
const service = new OrderService(fakeRepo, new FakeEmailSender())
service.placeOrder('A-1001', 'ada@example.com')
// [/test]
`,

  Visualization: DependencyInjectionVisualization,
}
