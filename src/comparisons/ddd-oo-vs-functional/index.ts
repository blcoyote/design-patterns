/**
 * Object-oriented and functional DDD are not two different architectures: they share the same
 * strategic design (bounded contexts, a ubiquitous language, an Anti-Corruption Layer on the seam)
 * and differ in how the tactical building blocks are written. Every claim below was checked
 * against `src/architectures/oo/ddd` and `src/architectures/functional/functional-ddd` (index.ts
 * and all four language examples). Where the languages differ, the wording is neutral or lists
 * each language: OO rejected commands throw in TypeScript, C# and Python but are returned as an
 * `error` in Go; functional rejected commands are a Result in TypeScript, C# and Python but a
 * `(value, error)` pair in Go.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "ddd-oo-vs-functional",
  title: "DDD: Object-oriented vs Functional",
  order: 5,
  summary:
    "Same bounded contexts, same Anti-Corruption Layer: one writes the tactical patterns as mutable objects, the other as immutable data and pure functions.",
  subjects: [
    { kind: "architecture", slug: "ddd" },
    { kind: "architecture", slug: "functional-ddd" },
  ],
  problem:
    "The Ordering context must accept a place-order command: add lines to a draft order, refuse to grow an order that has been placed, raise OrderPlaced, and let the Shipping context request a shipment without ever seeing Ordering's model. Both subjects solve exactly this, with the same Ordering and Shipping split. They differ in how the aggregate, its rules, its events and its dependencies are written.",
  constraints: [
    "Does your language and framework make immutable data, unions and pattern matching comfortable, or does the persistence layer expect mutable objects it can track?",
    "Should a state that must not exist (a total for an order that was never placed) be ruled out by types, or guarded by a run-time check inside a method?",
    "Should a rejected command be visible in the function's return type, or is raising an error the house style?",
    "Does the business logic need to be testable with plain values, with no repository, fake or mock in the way?",
    "Is the domain complex enough to justify DDD at all, or is it mostly records that get created, edited and read?",
  ],
  dimensions: [
    {
      label: "Aggregate representation",
      values: {
        ddd: "Order is a single class (a struct with methods in Go) that owns its state. Its lines and status are hidden behind its methods (private in TypeScript and C#, underscore-prefixed in Python, unexported in Go), and addLine and place change the same object in place.",
        "functional-ddd":
          "An order is plain data with no business methods: DraftOrder and PlacedOrder. The rules are separate functions (addLine, place) that return new values and never change their input (enforced by readonly, records and frozen dataclasses in TypeScript, C# and Python, by convention in Go).",
      },
    },
    {
      label: "Lifecycle (draft, then placed)",
      values: {
        ddd: "One Order type with a status field (draft or placed). Each method checks it at run time before acting, and a draft can be asked for its total just like a placed order.",
        "functional-ddd":
          "Draft and placed are separate types: a discriminated union in TypeScript, sealed records in C#, frozen dataclasses plus a Union in Python, a sealed interface in Go. Only PlacedOrder has a total, so the total of a draft cannot be written. addLine still accepts either case and rejects a placed one at run time.",
      },
    },
    {
      label: "Invariant violation",
      values: {
        ddd: "The aggregate rejects the command itself: addLine and place throw (Error in TypeScript, InvalidOperationException in C#, ValueError in Python), while in Go they return a non-nil error. In TypeScript, C# and Python nothing in the method's signature says it can fail.",
        "functional-ddd":
          "Rejection is a returned value: an Err inside a Result in TypeScript, C# and Python, a non-nil error in a (value, error) pair in Go. The signature says the step can fail, and the first failure skips the rest of the workflow. A programmer bug such as adding two currencies is still thrown (panicked in Go), not modelled.",
      },
    },
    {
      label: "Domain events",
      values: {
        ddd: "place appends OrderPlaced to a list inside the Order. The application service later calls pullEvents and dispatches whatever it gets (here, straight to the ACL). The event carries a timestamp.",
        "functional-ddd":
          "place returns the new PlacedOrder together with a list of events, and nothing is stored on the order. The handler loops over the returned events and passes each one on. The event carries no timestamp, which keeps the core pure.",
      },
    },
    {
      label: "Dependencies",
      values: {
        ddd: "OrderApplicationService receives its OrderRepository and ACL through its constructor (__init__ in Python, a NewOrderApplicationService function in Go) and keeps them as fields. The order policy is not injected: the service creates RequireAtLeastOneLine itself and passes it to place.",
        "functional-ddd":
          "The handler factory receives load, save, publish and the policy once, as a record of plain functions (an interface in TypeScript, a record in C#, a dataclass in Python, a struct in Go), and returns a closure over them. There is no service class that takes them in a constructor.",
      },
    },
    {
      label: "Repository",
      values: {
        ddd: "An OrderRepository interface (an abstract base class in Python) with findById and save, and an InMemoryOrderRepository (a struct in Go) that keeps a map behind it.",
        "functional-ddd":
          "OrderStore is a record of two functions, load and save, built by inMemoryOrderStore, whose closures hold a map. The handler depends only on the signatures of those two functions.",
      },
    },
    {
      label: "Anti-Corruption Layer",
      values: {
        ddd: "OrderingToShippingAcl is a class (a struct with a method in Go) that holds the ShippingService. translate builds the ShipmentRequested and itself calls requestShipment with it.",
        "functional-ddd":
          "toShipmentRequested is a pure function that only builds the ShipmentRequested. The handler passes the result to its publish dependency, which is wired to Shipping's requestShipment.",
      },
    },
  ],
  options: [
    {
      subject: "ddd",
      changes:
        "Order owns its state: place flips its status, appends OrderPlaced to its own list, and a later addLine is refused by the aggregate itself (a throw in TypeScript, C# and Python, a returned error in Go). OrderApplicationService loads the Order through OrderRepository, calls it, saves it and pulls the events, and OrderingToShippingAcl hands ShipmentRequested to Shipping.",
      chooseWhen: [
        "Your framework and persistence layer already work with mutable objects they load and track, and your team reads and writes classes more fluently than unions and function pipelines.",
        "You want the rules protected by hiding the state, so the only way to change an order is an operation on the aggregate that checks the rule.",
        "The aggregate has many small operations (add a line, change an address, apply a discount, cancel) and one class with its methods is easier to browse than a growing set of types and functions.",
      ],
      code: [
        { kind: "architecture", slug: "ddd", region: "order" },
        { kind: "architecture", slug: "ddd", region: "appService" },
        { kind: "architecture", slug: "ddd", region: "acl" },
      ],
      steps: [
        { kind: "architecture", slug: "ddd", step: 5 },
        { kind: "architecture", slug: "ddd", step: 7 },
        { kind: "architecture", slug: "ddd", step: 8 },
      ],
    },
    {
      subject: "functional-ddd",
      changes:
        "DraftOrder and PlacedOrder are separate immutable types. addLine and place are pure functions in rules, chained by the workflow, and a rejection comes back as an Err (a non-nil error in Go). The handler is the thin shell that loads, runs the workflow, saves and publishes, and the ACL is a pure function that only builds the ShipmentRequested.",
      chooseWhen: [
        "You want the compiler to help: only a placed order has a total, and every way a step can fail is visible in its return type.",
        "Business logic should be testable with plain values: the workflow takes an order, a command and a policy and returns a result, with no repository, fake or mock.",
        "The use case reads as a pipeline (validate, add, place, notify) with several ways to fail, and your language has decent support for immutable data, unions and pattern matching (or you accept the missing guarantees as conventions).",
      ],
      code: [
        { kind: "architecture", slug: "functional-ddd", region: "order" },
        { kind: "architecture", slug: "functional-ddd", region: "rules" },
        { kind: "architecture", slug: "functional-ddd", region: "handler" },
        { kind: "architecture", slug: "functional-ddd", region: "acl" },
      ],
      steps: [
        { kind: "architecture", slug: "functional-ddd", step: 5 },
        { kind: "architecture", slug: "functional-ddd", step: 7 },
        { kind: "architecture", slug: "functional-ddd", step: 8 },
      ],
    },
  ],
  noPattern: {
    when: "The domain is CRUD-shaped: orders are records that get created, edited and read, with little beyond field validation, no lifecycle rules, and no clash of vocabulary between teams.",
    instead:
      "Plain records (or rows) with validation on the way in and a simple service or transaction script. Neither style of DDD earns its weight yet; come back to it when real rules and a lifecycle appear.",
  },
  overlap:
    "This is not a fork in the road. The strategic design is identical: the same Ordering and Shipping contexts, the same ubiquitous language (OrderPlaced, ShipmentRequested), and an ACL on the seam. Only the tactical code differs. Mixing is common: the object-oriented example's Money and OrderLine are already immutable value objects, and two bounded contexts can use different styles because the ACL is where they meet.",
  scenario: {
    prompt:
      "A team is building the Ordering context in TypeScript. Orders go from draft to placed and have several business rules. Their pain points: code keeps asking an order that was never placed for its total, rejected commands surface as exceptions that no signature mentions, and testing a use case means wiring up a fake repository. Orders are loaded and saved as whole documents, and no ORM tracks changes to objects. Which tactical style should they use?",
    choices: [
      {
        id: "functional-ddd",
        option: "functional-ddd",
        label: "Functional DDD: separate Draft and Placed types, errors as values, a pure workflow",
        verdict: "best",
        explanation:
          "Each pain point has a direct answer in the functional example: only PlacedOrder has a total, so asking a draft for it cannot be written; addLine and place return an Err instead of throwing, so the failure is in the signature; and the workflow takes an order, a command and a policy and returns a result, so it runs without a repository or fake. Nothing in the setup (document persistence, no change-tracking ORM) pulls toward mutable objects, and the bounded contexts and ACL stay the same.",
      },
      {
        id: "oo-ddd",
        option: "ddd",
        label: "Object-oriented DDD: an Order aggregate class behind an application service",
        verdict: "workable",
        explanation:
          "It is valid DDD with the same bounded contexts and ACL, and the aggregate does protect its invariant. But the three pain points are what the object-oriented example leaves in place: any Order can be asked for its total, TypeScript, C# and Python reject commands by throwing, and the use case needs a repository behind the application service. This is a defensible choice if the team has other strong reasons for objects, but it fights the stated problems rather than removing them.",
      },
      {
        id: "no-ddd",
        option: "none",
        label: "No DDD: plain order records with validation functions",
        verdict: "poor",
        explanation:
          "That suits a CRUD-shaped domain. Here there is a lifecycle and a set of business rules that must hold no matter who calls, and a second context that must not see Ordering's model. Plain records with validation would scatter those rules and leave the Shipping boundary to chance.",
      },
      {
        id: "not-real-ddd",
        label: "Object-oriented, because DDD requires aggregate classes",
        verdict: "poor",
        explanation:
          "DDD does not require classes. Bounded contexts, a ubiquitous language, aggregates as consistency boundaries, domain events and an Anti-Corruption Layer are all present in the functional example, written as data and functions. The aggregate is a consistency boundary, not necessarily a class.",
      },
    ],
  },
};
