import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { FunctionalDddVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "functional-ddd",
  name: "Domain-Driven Design (Functional)",
  paradigm: "functional",
  order: 4,
  summary:
    "Use the business’s language in the code, but model it as immutable data and pure functions instead of mutable objects.",
  intent:
    "Put the business domain at the center of the design, as in object-oriented DDD, but express the model with plain data types, pure functions and explicit results. The types carry the rules, so an invalid order is hard to even write, and everything that touches the outside world sits in a thin shell around a pure core.",
  problem:
    "In a mutable domain model, a rule can only be checked at run time, inside whichever method happens to be called. An order object can be in any state, so any caller can ask for the total of a draft or add a line to an order that is already placed. Failures surface as exceptions that no signature mentions, and the business logic gets tangled up with loading, saving and publishing, so it cannot be tested without fakes.",
  solution:
    "Split a large system into bounded contexts, exactly as in DDD, then model each context with data and functions. Value objects are plain data that the code never mutates (the language enforces this in TypeScript, C# and Python; in Go it is a convention). A smart constructor, a function that returns a result, builds a value only when it is valid. A lifecycle becomes a set of types (Draft and Placed), so only a placed order has a total; that is a discriminated union in TypeScript, sealed records under an abstract record in C#, frozen dataclasses with a Union in Python and a sealed interface in Go. Business rules are pure functions that return new values. A rejected command comes back as an error value (a Result with Ok and Err in TypeScript, C# and Python, a (value, error) pair in Go), and a state change returns its domain events next to the new value instead of collecting them on the object. A workflow chains the steps into one pure pipeline that stops at the first failure. A thin imperative shell loads the data, runs the workflow, saves the result and publishes the events, with its dependencies passed in as functions. Between contexts, a pure anti-corruption function translates one context’s event into the other’s vocabulary. This page follows Scott Wlaschin’s Domain Modeling Made Functional and tells the same Ordering and Shipping story as the object-oriented sibling page.",
  analogy:
    "A factory assembly line with an inspection gate. Raw parts arrive at the gate, and each station checks a part, builds a new one from it and passes that along; a station never alters the part it was handed. A defective part is tagged and sent down a reject track instead of stopping the whole line. None of the stations touches the loading dock: a small crew at the dock unloads the parts, stores the finished product and ships it.",
  whenToUse: [
    "The domain has real rules, and you want the types to carry them: the lifecycle and the invalid states are worth encoding so that the compiler helps.",
    "Business logic needs to be easy to test without databases, clocks or message brokers. Pure functions only need values in and values out.",
    "The use cases are naturally pipelines (validate, price, place, notify) with several ways to fail, and you want every failure to be visible in the signatures.",
    "Your language has decent support for immutable data, unions and pattern matching, or you are willing to follow the missing guarantees as conventions.",
  ],
  pros: [
    "Illegal states can be made unrepresentable: only a placed order has a total, so asking for the total of a draft cannot even be written.",
    "Pure rules are easy to test. The workflow in this example runs on plain values, with no store, no fake and no mock.",
    "Failures are part of the signature: a function that can reject its input says so in its return type, and the first failure skips the rest of the pipeline.",
    "Side effects are confined to the shell, so it is easy to see where I/O happens: load, save and publish, in the handler.",
    "Nothing is mutated: the draft that was loaded is still the same empty draft after the order has been placed, so there are no aliasing or ordering surprises.",
  ],
  cons: [
    "It needs a different mindset, and a new vocabulary for many teams: smart constructors, bind, railway, type-state.",
    "Language support varies. C# and Go cannot check that a match covers every case and need a throwing or panicking default, and in Python only an external type checker can flag a missing case; Go has no sum types and no bind helper that reads well (it uses early returns); and “only through the smart constructor” stays a convention where constructors or struct fields are public.",
    "Every transition builds a new value instead of changing one in place. That is cheap for small aggregates, but large ones may need persistent data structures.",
    "A rich lifecycle means many types (Draft, Placed, Shipped, …) and conversion functions between them.",
    "It shares DDD’s upfront cost: finding the bounded contexts and building a ubiquitous language still takes time and access to domain experts.",
  ],
  realWorld: [
    "Scott Wlaschin’s Domain Modeling Made Functional (and his F# for Fun and Profit articles) is the canonical reference; this page follows its order-taking style of workflow.",
    "Teams on F#, Scala, Haskell and Rust, and TypeScript teams using libraries such as fp-ts or Effect, build domain models from unions, smart constructors and result types in the same way.",
    "Gary Bernhardt’s Functional Core, Imperative Shell is the structure of the handler here: the shell does the I/O and the core only computes.",
    "Event-sourced systems written functionally often split the aggregate into decide and evolve functions (the Decider, see the variants).",
  ],
  concepts: [
    {
      term: "Ubiquitous Language",
      description:
        "A vocabulary shared by developers and domain experts. In a functional model it shows up as type and function names: PlacedOrder, createOrderLine and place read like what the business says.",
    },
    {
      term: "Bounded Context",
      description:
        "An explicit boundary inside which one model and its language apply. Ordering and Shipping each have their own types here, and the same business event is a different type on each side of the boundary.",
    },
    {
      term: "Value Object",
      description:
        "Plain data that is defined by its fields, has no identity and is never changed after it is created. Money and OrderLine are value objects; an operation on one returns a new one.",
    },
    {
      term: "Aggregate",
      description:
        "A cluster of data treated as one consistency boundary. Here the Order and its lines are plain data, and the invariant (no new lines once placed) lives in the transition functions and the types, not in a method on a class.",
    },
    {
      term: "Domain Event",
      description:
        "Something that happened in the domain, named in the past tense. OrderPlaced is plain data that place returns next to the new order, so nothing has to collect it on the order or call out to anyone.",
    },
    {
      term: "Anti-Corruption Layer",
      description:
        "A translation owned by the downstream context. Here it is a pure function from Ordering’s OrderPlaced to Shipping’s ShipmentRequested; delivering the result is the shell’s job.",
    },
    {
      term: "Smart Constructor",
      description:
        "A function that is the one place a value is built and that checks the rules first, returning a result instead of an invalid value. createOrderLine rejects a quantity below 1. In all four languages the type itself stays constructible elsewhere, so this is a convention unless the language can hide the constructor.",
    },
    {
      term: "Type-State (illegal states unrepresentable)",
      description:
        "Each state of a lifecycle is its own type, so a state that must not exist cannot be written. A DraftOrder has no total and a PlacedOrder does. A match over the cases is checked for completeness in TypeScript; C# and Go need a throwing or panicking default case, and Python’s match is not checked.",
    },
    {
      term: "Workflow",
      description:
        "A use case as one pure function that chains steps into a pipeline: validate each raw line, add it, place the order. Its inputs and outputs are values, and it performs no I/O.",
    },
    {
      term: "Errors as Values (railway)",
      description:
        "A step that can fail returns a result instead of throwing. Chaining steps with bind, or with early returns in Go, puts the code on a success track and a failure track: the first Err skips every later step. Programmer bugs, such as adding two currencies, are still thrown or panicked, not modelled.",
    },
    {
      term: "Imperative Shell",
      description:
        "The thin layer around the pure core that does the I/O: load, save and publish. It is built once with its dependencies as functions, calls the workflow in the middle, and holds no business rules.",
    },
  ],
  variants: [
    {
      name: "Decider",
      description:
        "Splits the aggregate into two pure functions: decide(command, state) returns the events, and evolve(state, event) returns the next state. It is the same idea as this page with events as the central data, and it is the natural fit for Event Sourcing, which has its own page.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "value-object",
        why: "Money and OrderLine are value objects as plain data: no identity and never changed after creation. The smart constructor createOrderLine adds validation, though none of the four languages stops other code from building an OrderLine directly. The Value Object pattern also covers strongly typed ids.",
      },
      {
        slug: "repository",
        why: "The order store is a repository written as a record of two functions, load and save, that close over an in-memory map. The handler only depends on the signatures of those functions, so it does not know where orders live.",
      },
      {
        slug: "anti-corruption-layer",
        why: "toShipmentRequested is a minimal, single-event instance of the general pattern, written as a pure function. The standalone Anti-Corruption Layer example shows the fuller case, including normalizing an upstream system’s unmapped codes and malformed data.",
      },
      {
        slug: "adapter",
        why: "The Anti-Corruption Layer adapts OrderPlaced, Ordering’s event, into ShipmentRequested, the shape Shipping expects, and it does so with a function instead of an adapter class.",
      },
      {
        slug: "strategy",
        why: "The order policy (“an order needs at least one line to be placed”) is a function passed into the workflow and on to place. Swapping the function changes the rule without touching place, which is Strategy with a function value instead of a class hierarchy.",
      },
      {
        slug: "state",
        why: "The lifecycle, Draft then Placed, is modelled as two types instead of a status field with State classes. Behaviour lives in functions that match on the case, so the type tells you which transitions apply.",
      },
      {
        slug: "dependency-injection",
        why: "makePlaceOrderHandler receives load, save, publish and the policy once, as functions in a record, and returns a closure over them. The wiring happens at one call site, with no constructor, interface or container.",
      },
      {
        slug: "pub-sub",
        why: "The handler’s publish dependency is a function, and in this example it points straight at Shipping’s requestShipment. A real system would hand ShipmentRequested to a publish/subscribe channel at that seam instead.",
      },
    ],
    architectures: [
      {
        slug: "ddd",
        why: "The object-oriented version of the same Ordering and Shipping scenario: a mutable aggregate that throws, domain events collected on the aggregate, and a repository interface behind an application service. Reading the two side by side shows what changes and what stays when the tactical patterns move from objects to functions.",
      },
      {
        slug: "functional-core",
        why: "The pure workflow is the functional core and the place-order handler is the imperative shell around it: the handler loads the order, calls placeOrderWorkflow, and only on success saves and publishes. All the business rules (createOrderLine, addLine, place) take values and return values, so they run without a store, a clock or a broker.",
      },
      {
        slug: "event-sourcing",
        why: "place returns its OrderPlaced event next to the new order instead of collecting it on an object, which is the shape Event Sourcing wants: those events could be appended to a stream. This example saves the PlacedOrder itself and does not append events or replay them; splitting the rules into decide and evolve (the Decider variant) is the step that gets there.",
      },
      {
        slug: "pipes-and-filters",
        why: "placeOrderWorkflow is a short pipeline for one order: each raw line goes through createOrderLine and addLine, then place, with each step's output feeding the next. It is a railway over a single value, so the first failure stops everything after it, whereas Pipes and Filters streams many records through independent stages and lets rejected records keep flowing.",
      },
      {
        slug: "event-driven",
        why: "The handler turns each returned OrderPlaced into Shipping's ShipmentRequested with a pure ACL function and passes it to publish. Here publish is wired straight to Shipping's requestShipment, but pointing it at a broker topic makes these the integration events that other bounded contexts subscribe to.",
      },
    ],
  },

  // Diagram (custom scene — an Ordering context with a pure core, and a Shipping context joined by an ACL)
  viewBox: "0 0 920 560",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 150,
      y: 40,
      description:
        "A caller outside the Ordering bounded context: a UI, another service, or the usage code at the bottom of the example. It sends a command with raw, unvalidated lines and never touches the workflow or the store directly.",
    },
    {
      id: "handler",
      label: "placeOrderHandler",
      role: "Imperative shell",
      kind: "class",
      x: 150,
      y: 165,
      width: 170,
      description:
        "The thin shell around the pure core, and the only place that does I/O for this use case. It is built once, with its dependencies (load, save, publish and the order policy) captured in a closure, and then called with a command: it loads the order, runs the pure workflow and, on success, saves the result and publishes the events.",
      patterns: ["dependency-injection"],
    },
    {
      id: "orderStore",
      label: "OrderStore",
      role: "Repository (functions)",
      kind: "class",
      x: 450,
      y: 165,
      width: 150,
      description:
        "The repository as a record of two functions, load and save, that close over an in-memory map (Map, Dictionary, dict or map). Saving replaces whatever was stored under that id, and loading may find nothing. Nothing else in the context knows where orders live.",
      patterns: ["repository"],
    },
    {
      id: "workflow",
      label: "placeOrderWorkflow",
      role: "Pure use case",
      kind: "class",
      x: 150,
      y: 300,
      width: 190,
      description:
        "The use case as one pure function: an order, a command and a policy in, a result out. It validates each raw line, adds it to the draft and then places the order, and the first failure skips everything after it. It does no I/O, so it can be tested with plain values.",
      patterns: ["strategy"],
    },
    {
      id: "money",
      label: "Money",
      role: "Value object",
      kind: "object",
      x: 320,
      y: 430,
      width: 120,
      description:
        "A value object as plain data: cents and a currency, with no identity. money() rounds half away from zero. Adding two currencies is treated as a programmer bug, so addMoney throws (panics in Go) instead of returning an error value.",
      patterns: ["value-object"],
    },
    {
      id: "orderLine",
      label: "OrderLine",
      role: "Value object",
      kind: "object",
      x: 140,
      y: 430,
      width: 140,
      description:
        "A value object holding a sku, a unit price (a Money) and a quantity. It is built by the smart constructor createOrderLine, which returns an error value for a quantity below 1. Other code could still construct one directly, so “only through the constructor” is a convention.",
      patterns: ["value-object"],
    },
    {
      id: "order",
      label: "Draft | Placed",
      role: "Type-state aggregate",
      kind: "object",
      x: 450,
      y: 300,
      width: 160,
      description:
        "The Order as two types. A DraftOrder has an id, a customer and lines; a PlacedOrder has the same plus a total, so the total of a draft cannot be asked for. The code never changes an order in place: a transition builds a new value. It is a discriminated union in TypeScript, sealed records in C#, frozen dataclasses with a Union in Python and a sealed interface in Go.",
      patterns: ["state"],
    },
    {
      id: "orderPlaced",
      label: "OrderPlaced",
      role: "Domain event",
      kind: "object",
      x: 520,
      y: 430,
      width: 150,
      description:
        "The domain event as plain data, returned by place next to the new PlacedOrder. It is not appended to the order or stored, and it carries no timestamp: the shell would stamp the time, which keeps the core pure.",
    },
    {
      id: "acl",
      label: "ACL",
      role: "Anti-Corruption Layer",
      kind: "class",
      x: 669,
      y: 300,
      width: 120,
      description:
        "Sits on the seam between the two contexts and, conceptually owned by the downstream Shipping context, translates Ordering’s OrderPlaced into Shipping’s own ShipmentRequested. It is a pure function that only builds a new value; handing the result on is the handler’s job.",
      patterns: ["anti-corruption-layer", "adapter"],
    },
    {
      id: "shipping",
      label: "requestShipment",
      role: "Shipping bounded context",
      kind: "class",
      x: 818,
      y: 430,
      width: 150,
      description:
        "Lives in the Shipping bounded context. ShipmentRequested is its own type, and requestShipment is its side effect (it prints a line). It has never heard of an Order or an OrderPlaced; it only reuses the small Money type from Ordering.",
    },
  ],
  relations: [
    {
      id: "cmd",
      from: "client",
      to: "handler",
      type: "calls",
      label: "placeOrder(cmd)",
      description:
        "The client sends a command: an order id and raw lines (sku, price, quantity). The handler is the only thing in Ordering it calls directly.",
      code: "handler",
    },
    {
      id: "load",
      from: "handler",
      to: "orderStore",
      type: "calls",
      label: "load(orderId)",
      description:
        "I/O at the edge. The handler calls the store’s load function with the order id, instead of knowing anything about how orders are stored.",
      bend: -24,
      code: "orderStore",
    },
    {
      id: "manages",
      from: "orderStore",
      to: "order",
      type: "holds",
      description:
        "The store is the only thing whose job is to know where orders live. Everything else works with the order as a plain value in memory.",
      code: "orderStore",
    },
    {
      id: "run",
      from: "handler",
      to: "workflow",
      type: "calls",
      label: "workflow(cmd)",
      description:
        "The handler passes the loaded order, the command and the policy to the pure workflow and gets a result back. The workflow performs no I/O.",
      code: "workflow",
    },
    {
      id: "validate",
      from: "workflow",
      to: "orderLine",
      type: "calls",
      label: "createOrderLine",
      description:
        "For each raw line the workflow calls the smart constructor, which returns either a valid OrderLine or an error value, never an invalid line.",
      code: "orderLine",
    },
    {
      id: "unitPrice",
      from: "orderLine",
      to: "money",
      type: "holds",
      description:
        "An OrderLine holds its unit price as a Money value, built from the raw price with money(), which rounds half away from zero.",
      code: "money",
    },
    {
      id: "addLine",
      from: "workflow",
      to: "order",
      type: "calls",
      label: "addLine(line)",
      description:
        "The workflow adds a validated line to the order. On a draft the result is a new draft with one more line; on a placed order it is an error value.",
      bend: -20,
      code: "rules",
    },
    {
      id: "place",
      from: "workflow",
      to: "order",
      type: "calls",
      label: "place(policy)",
      description:
        "Once every line is added, the workflow places the order. The policy function decides whether the draft may be placed; if it may, the result is a new PlacedOrder together with its events.",
      bend: 20,
      code: "rules",
    },
    {
      id: "owns",
      from: "order",
      to: "orderLine",
      type: "holds",
      description:
        "An order holds its OrderLines in a list that is copied, not changed, when a line is added: adding a line builds a new list and leaves the old one alone.",
      code: "order",
    },
    {
      id: "total",
      from: "order",
      to: "money",
      type: "holds",
      label: "total",
      description:
        "Only a PlacedOrder holds a total. place folds every line’s total into one Money with addMoney, which returns a new Money each time.",
      code: "money",
    },
    {
      id: "raise",
      from: "order",
      to: "orderPlaced",
      type: "creates",
      label: "[OrderPlaced]",
      description:
        "When a draft is placed, the same function that builds the PlacedOrder also builds an OrderPlaced event and returns it next to the order. It does not store the event or call out to anything.",
      code: "orderPlaced",
    },
    {
      id: "save",
      from: "handler",
      to: "orderStore",
      type: "calls",
      label: "save(order)",
      description:
        "Only when the workflow succeeded does the handler save the new PlacedOrder, replacing the draft stored under the same id.",
      bend: 24,
      code: "orderStore",
    },
    {
      id: "cross",
      from: "orderPlaced",
      to: "acl",
      type: "notifies",
      label: "OrderPlaced",
      description:
        "The handler passes each returned event to the ACL. OrderPlaced reaches the boundary of the Ordering context and goes no further in its own shape: Shipping is never handed an Ordering type directly.",
      code: "acl",
    },
    {
      id: "translate",
      from: "acl",
      to: "shipping",
      type: "calls",
      label: "ShipmentRequested",
      description:
        "The ACL builds a ShipmentRequested, a type from Shipping’s own vocabulary, out of what it read off OrderPlaced. The handler then calls publish with it, and publish is wired to Shipping’s requestShipment.",
      code: "shipping",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Two bounded contexts, a pure core and a thin shell",
      description:
        "Ordering and Shipping are separate bounded contexts, each with its own types; they share only the small Money type. Inside Ordering, a pure core of data types and functions with no I/O is wrapped by a thin imperative shell that loads, saves and publishes. An Anti-Corruption Layer, also a pure function, sits on the seam between the two contexts.",
      highlight: [
        "client",
        "handler",
        "orderStore",
        "workflow",
        "money",
        "orderLine",
        "order",
        "orderPlaced",
        "acl",
        "shipping",
      ],
    },
    {
      title: "A command with raw lines reaches the handler",
      description:
        "A place-order command arrives from outside the context: an order id and two raw lines, WIDGET at 19.99 × 2 and GADGET at 29.99 × 1. They are plain strings and numbers, not yet domain values. The handler is Ordering’s single entry point, a function that was built once with its dependencies.",
      highlight: ["client", "cmd", "handler"],
      packets: [{ relation: "cmd", label: "placeOrder(cmd)" }],
      notes: { handler: "2 raw lines" },
      code: "handler",
    },
    {
      title: "The shell loads the order through the store",
      description:
        "First the I/O at the edge: the handler calls load with the order id and gets the current order back, here the empty draft the usage code saved earlier. If load found nothing, the handler would return the error value “no such order” and never run the workflow.",
      highlight: ["handler", "load", "orderStore", "manages", "order"],
      packets: [
        { relation: "load", label: "load(orderId)" },
        { relation: "load", label: "Order", reverse: true, after: 0 },
      ],
      notes: { orderStore: "order-1: draft, 0 lines" },
      code: "orderStore",
    },
    {
      title: "Smart constructors turn raw lines into domain values",
      description:
        "The handler runs the pure workflow, which takes each raw line in turn and calls createOrderLine with money(price). A valid line becomes an OrderLine holding a Money (19.99 becomes 1999 cents). A quantity below 1 comes back as an Err value instead; the usage code’s BROKEN line with quantity 0 is rejected with “invalid line BROKEN: quantity must be at least 1”. Each step is chained, so the first failure skips all the later ones.",
      highlight: ["handler", "run", "workflow", "validate", "orderLine", "unitPrice", "money"],
      packets: [
        { relation: "run", label: "workflow(cmd)" },
        { relation: "validate", label: "createOrderLine", after: 0 },
        { relation: "validate", label: "Ok(OrderLine)", reverse: true, after: 1 },
      ],
      notes: { money: "19.99 → 1999 cents", orderLine: "Ok, or Err if qty < 1" },
      code: "orderLine",
    },
    {
      title: "addLine returns a new draft each time",
      description:
        "For each valid line the workflow calls addLine. On a draft it builds a new DraftOrder whose lines are a copy of the old ones plus the new line, and the order it was given is never changed; the usage code confirms it, because the original draft still has 0 lines at the end. After WIDGET and GADGET the newest draft has 2 lines.",
      highlight: ["workflow", "addLine", "order", "owns", "orderLine"],
      packets: [
        { relation: "addLine", label: "addLine(line)" },
        { relation: "addLine", label: "Ok(new draft)", reverse: true, after: 0 },
      ],
      notes: { order: "new draft, 2 lines" },
      code: "rules",
    },
    {
      title: "place turns the draft into a placed order",
      description:
        "With all lines added, the workflow calls place with the policy. The policy function (“at least one line”) accepts the draft, the line totals are folded into one Money (3998 + 2999 cents = 69.97 USD), and the result is a PlacedOrder, a different type that has a total. An OrderPlaced event is built at the same moment but only returned next to the order: nothing is stored or published here.",
      highlight: ["workflow", "place", "order", "total", "money", "raise", "orderPlaced"],
      packets: [
        { relation: "place", label: "place(policy)" },
        { relation: "total", label: "addMoney", after: 0 },
        { relation: "raise", label: "[OrderPlaced]", after: 1 },
      ],
      notes: {
        order: "draft → placed",
        money: "69.97 USD",
        orderPlaced: "returned, not stored",
      },
      code: "rules",
    },
    {
      title: "The shell saves the new value",
      description:
        "The workflow has returned Ok(outcome) to the handler (in Go, a nil error). Only now, on success, does the handler call save with the placed order, replacing the draft stored under order-1. Had any earlier step failed, the handler would have returned the error and nothing would have been saved.",
      highlight: ["workflow", "run", "handler", "save", "orderStore"],
      packets: [
        { relation: "run", label: "Ok(outcome)", reverse: true },
        { relation: "save", label: "save(order)", after: 0 },
      ],
      notes: { orderStore: "order-1: placed" },
      code: "orderStore",
    },
    {
      title: "The ACL translates the event, the shell publishes it",
      description:
        "For each returned event the handler matches on the event’s case and passes an OrderPlaced to toShipmentRequested, a pure function that builds Shipping’s own ShipmentRequested (id ship-order-1, recipient cust-42, value 69.97 USD). The handler then calls publish, which is wired to Shipping’s requestShipment; that call prints the first line of the example’s output.",
      highlight: ["handler", "orderPlaced", "cross", "acl", "translate", "shipping"],
      packets: [
        { relation: "cross", label: "OrderPlaced" },
        { relation: "translate", label: "ShipmentRequested", after: 0 },
      ],
      notes: { acl: "ship-order-1", shipping: "cust-42, 69.97 USD" },
      code: "acl",
    },
    {
      title: "Afterwards, addLine on the placed order is an error value",
      description:
        "The handler has returned and the stored order is now a PlacedOrder. Calling addLine on it again, as the usage code does with a LATE-ITEM, does not throw: the placed case returns an Err (in Go, a non-nil error), “cannot add a line to order order-1: already placed”. It is the same addLine the workflow uses. The invariant lives in the function and in the types, so it holds for any caller, and the caller gets the failure as a value.",
      highlight: ["workflow", "addLine", "order"],
      packets: [{ relation: "addLine", label: "addLine(line) ✗" }],
      notes: { order: "Err: already placed" },
      code: "rules",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: FunctionalDddVisualization,
};
