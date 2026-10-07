/**
 * All three patterns put one object in front of another and forward calls through it, which is
 * why they blur together at a glance. Every claim below was checked against
 * `src/patterns/structural/adapter`, `src/patterns/structural/facade` and
 * `src/patterns/structural/decorator` (index.ts and all four language examples) rather than against
 * the patterns in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "adapter-vs-facade-vs-decorator",
  title: "Adapter vs Facade vs Decorator",
  order: 2,
  summary:
    "All three wrap something — but to translate an interface, hide a subsystem, or add behavior?",
  subjects: [
    { kind: "pattern", slug: "adapter" },
    { kind: "pattern", slug: "facade" },
    { kind: "pattern", slug: "decorator" },
  ],
  problem:
    "Sometimes a client needs an object between it and another part of the system. Choose the wrapper based on its job: translate an incompatible interface (Adapter), simplify calls to several objects (Facade), or add behavior while keeping the same interface (Decorator).",
  constraints: [
    "Is there one object with the wrong-shaped interface, or several objects with the right interface but too many of them to call directly?",
    "Does the wrapper need to expose the exact same interface as what it wraps, or is a new, simpler interface the whole point?",
    "Should the wrapping be stackable — many layers, added or removed at runtime — or is one fixed layer enough?",
    "Is the goal to make existing code reusable unchanged, or to simplify how client code talks to a subsystem?",
  ],
  dimensions: [
    {
      label: "Intent",
      values: {
        adapter: "Convert one interface into another interface clients already expect.",
        facade: "Provide one simple, higher-level interface in front of a multi-object subsystem.",
        decorator: "Attach additional behavior to an object, while keeping its original interface.",
      },
    },
    {
      label: "Interface after wrapping",
      values: {
        adapter:
          "Different from the wrapped object — StripeAdapter exposes PaymentProcessor, not LegacyStripeGateway’s own methods.",
        facade:
          "New and narrower than the subsystem — one watchMovie() call replaces four subsystem objects and their protocol.",
        decorator:
          "Identical to the wrapped object — SugarDecorator implements the same Coffee interface as SimpleCoffee.",
      },
    },
    {
      label: "How many objects are wrapped",
      values: {
        adapter: "One: a single adaptee (LegacyStripeGateway) behind a single adapter.",
        facade:
          "Several: HomeTheaterFacade owns and sequences four subsystem objects (Amplifier, Projector, Screen, DvdPlayer).",
        decorator:
          "One at a time, but stackable — MilkDecorator wraps SimpleCoffee, and SugarDecorator wraps MilkDecorator in turn.",
      },
    },
    {
      label: "Can it be stacked",
      values: {
        adapter:
          "Not usually — one adapter translates for one adaptee; chaining adapters is possible but rare.",
        facade:
          "Rarely — one facade sits in front of one subsystem (a larger facade may sit over smaller ones).",
        decorator:
          "Yes — decorators wrap decorators, to any depth, in any order chosen at runtime.",
      },
    },
    {
      label: "What the client is shielded from",
      values: {
        adapter:
          "The adaptee’s incompatible method names and data shapes (chargeCents, cents) behind the shape it already expects (charge, dollars).",
        facade: "The number of subsystem objects and the order calls must happen in.",
        decorator:
          "Nothing about the interface — the client sees exactly the same contract, just richer behavior.",
      },
    },
    {
      label: "Typical motivation",
      values: {
        adapter: "You cannot change the adaptee (legacy or third-party code) but must make it fit.",
        facade: "The subsystem is correct but tedious to drive directly, every time.",
        decorator:
          "Subclassing for every combination of extra behavior would explode into too many classes.",
      },
    },
  ],
  options: [
    {
      subject: "adapter",
      changes:
        "StripeAdapter implements PaymentProcessor around LegacyStripeGateway. It converts the client’s dollar amount to cents, calls chargeCents(), then converts the result back to a receipt. The client can use the old library through the interface it already expects.",
      chooseWhen: [
        "An existing class does what you need, but its interface does not match what your code already expects.",
        "You cannot modify the incompatible class because it is third-party or legacy.",
        "There is exactly one thing to translate, not a whole subsystem to simplify.",
      ],
      code: [
        { kind: "pattern", slug: "adapter", region: "adapter" },
        { kind: "pattern", slug: "adapter", region: "charge" },
      ],
      steps: [
        { kind: "pattern", slug: "adapter", step: 0 },
        { kind: "pattern", slug: "adapter", step: 2 },
      ],
    },
    {
      subject: "facade",
      changes:
        "HomeTheaterFacade wraps the Amplifier, Projector, Screen, and DvdPlayer, then calls them in the right order. The client uses one watchMovie() call instead of coordinating four objects.",
      chooseWhen: [
        "Several objects must be used together, in a specific order, to get anything useful done.",
        "You want to decouple client code from subsystem internals that might change later.",
        "You are not trying to match an existing interface — a brand-new, simpler one is the goal.",
      ],
      code: [
        { kind: "pattern", slug: "facade", region: "facade" },
        { kind: "pattern", slug: "facade", region: "watchMovie" },
      ],
      steps: [
        { kind: "pattern", slug: "facade", step: 0 },
        { kind: "pattern", slug: "facade", step: 4 },
      ],
    },
    {
      subject: "decorator",
      changes:
        "MilkDecorator and SugarDecorator both implement Coffee and wrap another Coffee. Stack them around SimpleCoffee in either order; cost() adds $0.50 for milk and $0.25 for sugar to the $2.00 base price. The original coffee and its callers do not need to change.",
      chooseWhen: [
        "You need to add responsibilities to one object instance, not to every instance of its class.",
        "The combinations of extra behavior would otherwise need a subclass each.",
        "Behavior should be composable at runtime — added, layered, or left off per instance.",
      ],
      code: [
        { kind: "pattern", slug: "decorator", region: "coffeeDecorator" },
        { kind: "pattern", slug: "decorator", region: "sugarDecorator" },
      ],
      steps: [
        { kind: "pattern", slug: "decorator", step: 0 },
        { kind: "pattern", slug: "decorator", step: 4 },
      ],
    },
  ],
  noPattern: {
    when: "There is only one incompatible call to translate, one subsystem call sequence that never repeats, or one piece of extra behavior that never needs to come off.",
    instead:
      "Adapter: a wrapper function is enough until more than one client needs the translation. Facade: call the subsystem directly until a second caller needs the same sequence. Decorator: use a flag or if-statement for one optional behavior; use decorators when behaviors combine or need to be added and removed at runtime.",
  },
  overlap:
    "These patterns can be combined. A Facade may use Adapters if some subsystem interfaces do not match; the HomeTheaterFacade example does not need them because its objects already work together. Adapter and Decorator both wrap an object and forward calls, but their interfaces differ: an Adapter changes the interface, while a Decorator keeps it and adds behavior. At a bounded-context boundary, an Anti-Corruption Layer typically combines Adapter (and sometimes Facade) with active translation and normalization, so an upstream system's model — and its corrupt or unmapped data — cannot leak into the domain; a plain Adapter only promises an interface match, not that protection.",
  scenario: {
    prompt:
      "A codebase needs to call a third-party shipping library whose API is a single confusingly-named method that does not match the ShippingProvider interface the rest of the code uses. What fits best?",
    choices: [
      {
        id: "adapter",
        option: "adapter",
        label: "Adapter — wrap the library behind your own ShippingProvider interface",
        verdict: "best",
        explanation:
          "The library’s method does not match the interface your code expects, and you cannot change the library. An Adapter translates that method into the interface your code already uses.",
      },
      {
        id: "decorator-logging",
        option: "decorator",
        label: "Decorator — add a logging-and-retry layer around the adapter",
        verdict: "workable",
        explanation:
          "A Decorator keeps the interface it wraps, so it cannot fix the mismatch on its own — the Adapter still has to come first. Logging and retries are not part of this problem; if they are needed later, a Decorator can wrap the adapter without changing it or the client.",
      },
      {
        id: "facade",
        option: "facade",
        label: "Facade — give the library a simpler one-method entry point",
        verdict: "poor",
        explanation:
          "A Facade coordinates several subsystem objects. This problem has only one incompatible method to translate, so an Adapter is the better fit.",
      },
      {
        id: "inline",
        option: "none",
        label: "Call the library directly everywhere it’s needed",
        verdict: "workable",
        explanation:
          "This works at one call site, but each caller would repeat the library-specific call and its translation. A wrapper becomes useful when a second caller appears.",
      },
    ],
  },
};
