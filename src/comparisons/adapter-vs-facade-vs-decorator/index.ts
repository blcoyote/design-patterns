/**
 * All three patterns put one object in front of another and forward calls through it, which is
 * why they blur together at a glance. Every claim below was checked against
 * `src/patterns/structural/adapter`, `src/patterns/structural/facade` and
 * `src/patterns/structural/decorator` (index.ts and all four language examples) rather than against
 * the patterns in the abstract.
 */
import type { ComparisonDefinition } from '@/types/comparison'

export const comparison: ComparisonDefinition = {
  slug: 'adapter-vs-facade-vs-decorator',
  title: 'Adapter vs Facade vs Decorator',
  order: 2,
  summary: 'All three wrap something — but to translate an interface, hide a subsystem, or add behavior?',
  subjects: [
    { kind: 'pattern', slug: 'adapter' },
    { kind: 'pattern', slug: 'facade' },
    { kind: 'pattern', slug: 'decorator' },
  ],
  problem:
    'Some piece of code needs to sit between a client and another object. Depending on why, that in-between object should either translate a mismatched interface, collapse several objects into one simple call, or add extra behavior around a single object without changing what it looks like from outside.',
  constraints: [
    'Is there one object with the wrong-shaped interface, or several objects with the right interface but too many of them to call directly?',
    'Does the wrapper need to expose the exact same interface as what it wraps, or is a new, simpler interface the whole point?',
    'Should the wrapping be stackable — many layers, added or removed at runtime — or is one fixed layer enough?',
    'Is the goal to make existing code reusable unchanged, or to simplify how client code talks to a subsystem?',
  ],
  dimensions: [
    {
      label: 'Intent',
      values: {
        adapter: 'Convert one interface into another interface clients already expect.',
        facade: 'Provide one simple, higher-level interface in front of a multi-object subsystem.',
        decorator: 'Attach additional behavior to an object, while keeping its original interface.',
      },
    },
    {
      label: 'Interface after wrapping',
      values: {
        adapter: 'Different from the wrapped object — StripeAdapter exposes PaymentProcessor, not LegacyStripeGateway’s own methods.',
        facade: 'New and narrower than the subsystem — one watchMovie() call replaces four subsystem objects and their protocol.',
        decorator: 'Identical to the wrapped object — SugarDecorator implements the same Coffee interface as SimpleCoffee.',
      },
    },
    {
      label: 'How many objects are wrapped',
      values: {
        adapter: 'One: a single adaptee (LegacyStripeGateway) behind a single adapter.',
        facade: 'Several: HomeTheaterFacade owns and sequences four subsystem objects (Amplifier, Projector, Screen, DvdPlayer).',
        decorator: 'One at a time, but stackable — MilkDecorator wraps SimpleCoffee, and SugarDecorator wraps MilkDecorator in turn.',
      },
    },
    {
      label: 'Can it be stacked',
      values: {
        adapter: 'Not usually — one adapter translates for one adaptee; chaining adapters is possible but rare.',
        facade: 'Rarely — one facade sits in front of one subsystem (a larger facade may sit over smaller ones).',
        decorator: 'Yes — decorators wrap decorators, to any depth, in any order chosen at runtime.',
      },
    },
    {
      label: 'What the client is shielded from',
      values: {
        adapter: 'The adaptee’s incompatible method names and data shapes (chargeCents, cents) behind the shape it already expects (charge, dollars).',
        facade: 'The number of subsystem objects and the order calls must happen in.',
        decorator: 'Nothing about the interface — the client sees exactly the same contract, just richer behavior.',
      },
    },
    {
      label: 'Typical motivation',
      values: {
        adapter: 'You cannot change the adaptee (legacy or third-party code) but must make it fit.',
        facade: 'The subsystem is correct but tedious to drive directly, every time.',
        decorator: 'Subclassing for every combination of extra behavior would explode into too many classes.',
      },
    },
  ],
  options: [
    {
      subject: 'adapter',
      changes:
        'StripeAdapter implements PaymentProcessor and holds a LegacyStripeGateway. charge() converts dollars to cents, calls the legacy chargeCents(), and converts the result back, so the client’s charge(4.50) call works against code it was never written to call.',
      chooseWhen: [
        'An existing class does what you need, but its interface does not match what your code already expects.',
        'You cannot modify the incompatible class because it is third-party or legacy.',
        'There is exactly one thing to translate, not a whole subsystem to simplify.',
      ],
      code: [
        { kind: 'pattern', slug: 'adapter', region: 'adapter' },
        { kind: 'pattern', slug: 'adapter', region: 'charge' },
      ],
      steps: [
        { kind: 'pattern', slug: 'adapter', step: 0 },
        { kind: 'pattern', slug: 'adapter', step: 2 },
      ],
    },
    {
      subject: 'facade',
      changes:
        'HomeTheaterFacade owns the Amplifier, Projector, Screen and DvdPlayer, and watchMovie() calls all four in the right order. The client now makes one call instead of learning four classes and their required sequence.',
      chooseWhen: [
        'Several objects must be used together, in a specific order, to get anything useful done.',
        'You want to decouple client code from subsystem internals that might change later.',
        'You are not trying to match an existing interface — a brand-new, simpler one is the goal.',
      ],
      code: [
        { kind: 'pattern', slug: 'facade', region: 'facade' },
        { kind: 'pattern', slug: 'facade', region: 'watchMovie' },
      ],
      steps: [
        { kind: 'pattern', slug: 'facade', step: 0 },
        { kind: 'pattern', slug: 'facade', step: 4 },
      ],
    },
    {
      subject: 'decorator',
      changes:
        'MilkDecorator and SugarDecorator extend CoffeeDecorator, which implements Coffee and holds the wrapped Coffee it forwards to. Stacking SugarDecorator around MilkDecorator around SimpleCoffee makes cost() accumulate $0.50 and $0.25 on top of the $2.00 base, without SimpleCoffee or the client’s Coffee-typed code changing at all.',
      chooseWhen: [
        'You need to add responsibilities to one object instance, not to every instance of its class.',
        'The combinations of extra behavior would otherwise need a subclass each.',
        'Behavior should be composable at runtime — added, layered, or left off per instance.',
      ],
      code: [
        { kind: 'pattern', slug: 'decorator', region: 'coffeeDecorator' },
        { kind: 'pattern', slug: 'decorator', region: 'sugarDecorator' },
      ],
      steps: [
        { kind: 'pattern', slug: 'decorator', step: 0 },
        { kind: 'pattern', slug: 'decorator', step: 4 },
      ],
    },
  ],
  noPattern: {
    when: 'There is only one incompatible call to translate, one subsystem call sequence that never repeats, or one piece of extra behavior that never needs to come off.',
    instead:
      'For Adapter: a single wrapper function that converts arguments and calls the legacy method directly is enough until more than one client needs the translation. For Facade: inlining the four calls at the one call site is fine until a second call site needs the same sequence. For Decorator: a boolean flag or an if-check inside the original method covers one optional behavior; reach for the pattern once combinations multiply or behavior needs to attach and detach at runtime.',
  },
  overlap:
    'A Facade often builds on Adapter internally — if the subsystem’s classes had mismatched interfaces, the facade might hold adapters rather than the subsystem classes directly, though HomeTheaterFacade here does not need to because its subsystem classes already cooperate. Decorator and Adapter both hold a single wrapped object and forward calls to it, which is the part of the class diagram that looks alike; the difference is the interface at the wrapper’s boundary — StripeAdapter exposes a different interface than LegacyStripeGateway, while SugarDecorator exposes the exact same Coffee interface that SimpleCoffee does, just with richer behavior behind it.',
  scenario: {
    prompt:
      'A codebase needs to call a third-party shipping library whose API is a single confusingly-named method, and the team also wants to log and retry every call to it. What fits best?',
    choices: [
      {
        id: 'adapter',
        option: 'adapter',
        label: 'Adapter — wrap the library behind your own ShippingProvider interface',
        verdict: 'best',
        explanation:
          'The library’s interface does not match what your code expects, and you cannot change the library itself — translating its one odd method into the interface your code already uses is exactly what Adapter is for.',
      },
      {
        id: 'decorator-logging',
        option: 'decorator',
        label: 'Decorator — add a logging-and-retry layer around the adapter',
        verdict: 'workable',
        explanation:
          'Once the adapter exposes your own ShippingProvider interface, a decorator that implements that same interface and wraps it can add logging and retries without touching the adapter or the client. It is a good second step, but the adapter is still the one that actually solves the stated incompatibility — the decorator is an optional addition on top.',
      },
      {
        id: 'facade',
        option: 'facade',
        label: 'Facade — give the library a simpler one-method entry point',
        verdict: 'poor',
        explanation:
          'Facade is for coordinating several subsystem objects in the right order; here there is exactly one incompatible method to translate, not a multi-object subsystem to sequence, so Facade doesn’t match the actual problem.',
      },
      {
        id: 'inline',
        option: 'none',
        label: 'Call the library directly everywhere it’s needed, with logging inline',
        verdict: 'workable',
        explanation:
          'It works for a single call site, but every caller ends up coupled to the library’s odd method name and repeats the same logging-and-retry code — the moment a second call site or a second retry rule appears, the duplication starts to hurt.',
      },
    ],
  },
}
