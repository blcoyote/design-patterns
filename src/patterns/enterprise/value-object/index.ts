import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "value-object",
  name: "Value Object",
  category: "enterprise",
  order: 15,
  summary:
    "Model a concept by its values, not an identity: immutable, validated when created, and equal when its fields are equal.",
  intent:
    "Replace bare strings and numbers with small types that carry their own rules. A value object has no identity, cannot change once created, can only be created in a valid state, and is equal to any other instance with the same values. A strongly typed id is a value object that wraps an identifier so different kinds of id cannot be mixed up.",
  problem:
    "An order total is stored as a plain number and a currency as a plain string. Nothing stops a negative amount, a malformed currency code or adding euros to dollars, and every caller has to repeat the checks. Two equal prices held in different variables compare as unequal when compared by reference. The order id and the customer id are both strings, so passing them to a function in the wrong order compiles and runs, and quietly looks up the wrong record.",
  solution:
    "Make Money a type. It is created through a validating factory (a constructor in Python) that rejects a negative or out-of-range amount and a malformed currency code, its fields cannot change, and adding two amounts returns a new Money after checking that the currencies match and that the sum is valid. Equality compares amount and currency, so two Money instances holding 12.50 EUR are interchangeable. OrderId and CustomerId are likewise separate types wrapping a string, so the compiler or type checker rejects one where the other is expected. Order, by contrast, is an entity: it is identified by its OrderId, and its total is a Money.",
  analogy:
    "A banknote: it does not matter which €10 note you hold, since any other one is worth the same. A passport is the opposite, an entity: two people with the same name and birthday are still different people, and the passport number is what tells them apart.",
  whenToUse: [
    "A concept is fully described by its attributes and two instances with the same attributes are interchangeable: money, dates and ranges, addresses, coordinates, email addresses.",
    "A primitive carries rules that should hold everywhere it is used, such as non-negative, well-formed or in a fixed set.",
    "Identifiers of different kinds are easy to confuse, and mixing them up would cause a bug that is hard to spot.",
  ],
  pros: [
    "Rules live in one place, so an invalid value cannot be created through the factory and callers never re-check it.",
    "Immutability makes values safe to share and cache, with no defensive copying.",
    "Operations are named in the domain's language: adding shipping to a price instead of arithmetic on bare numbers.",
    "Strongly typed ids turn a whole class of argument-swap bugs into compile-time errors.",
  ],
  cons: [
    "More types and more boilerplate than a plain number or string, especially where the language lacks records or data classes.",
    "Every change produces a new object, which allocates, though small values are cheap.",
    "The type-level guarantee depends on the language: Python only gets it from a type checker, and in Go unexported fields guard other packages but not the same package, while the zero value of the type skips the factory entirely.",
    "The validation here checks the shape of a currency code, not that it exists. A real system would check a list of ISO 4217 codes.",
    "Values have to be converted at the edges, for example when reading from a database or serialising to JSON.",
  ],
  realWorld: [
    "Money, Duration and Instant types in most date and money libraries (java.time, NodaTime, Joda-Money)",
    "C# records and readonly record structs, Kotlin value classes, Python frozen dataclasses",
    "Strongly typed ids in Domain-Driven Design codebases, often generated (StronglyTypedId, Vogen)",
    "Domain-driven design's tactical building blocks: value objects sit inside aggregates alongside entities",
  ],
  related: ["repository", "flyweight"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Checkout",
      role: "Client",
      kind: "class",
      x: 110,
      y: 230,
      width: 150,
      description:
        "The calling code. It builds prices and ids, adds amounts together and places an order, and never touches a Money's fields directly.",
    },
    {
      id: "money",
      label: "Money",
      role: "Value object",
      kind: "class",
      x: 420,
      y: 90,
      width: 170,
      description:
        "An amount in cents and a currency. It is created through a validating factory that rejects bad values, and it never changes: adding returns a new Money and equality compares by value.",
    },
    {
      id: "order",
      label: "Order",
      role: "Entity",
      kind: "class",
      x: 420,
      y: 330,
      width: 170,
      description:
        "An entity, not a value object: it is identified by its OrderId, so two orders with the same total are still different orders. It holds a typed id, a typed customer id and a Money total.",
    },
    {
      id: "orderId",
      label: "OrderId",
      role: "Strongly typed id",
      kind: "class",
      x: 700,
      y: 250,
      width: 160,
      description:
        "A value object that wraps an order's identifier string. It is a separate type from CustomerId, so the two cannot be swapped without the compiler or type checker complaining.",
    },
    {
      id: "customerId",
      label: "CustomerId",
      role: "Strongly typed id",
      kind: "class",
      x: 700,
      y: 410,
      width: 160,
      description:
        "The same idea for customers. Both ids wrap a string, but because they are different types, passing a CustomerId where an OrderId is expected is an error.",
    },
  ],
  relations: [
    {
      id: "use",
      from: "client",
      to: "money",
      type: "calls",
      label: "create / add / compare",
      description:
        "The client creates Money through the factory, adds amounts and compares them. Every operation either returns a new Money or a plain answer.",
      code: "moneyCreate",
    },
    {
      id: "place",
      from: "client",
      to: "order",
      type: "creates",
      label: "new Order",
      description:
        "The client builds an Order from a typed OrderId, a typed CustomerId and a Money total.",
      code: "order",
    },
    {
      id: "holdsTotal",
      from: "order",
      to: "money",
      type: "holds",
      label: "total",
      description: "The order's total is a Money, shared safely because it can never change.",
      code: "order",
    },
    {
      id: "holdsId",
      from: "order",
      to: "orderId",
      type: "holds",
      label: "id",
      description: "The order is identified by its OrderId, which is what makes it an entity.",
      code: "orderId",
    },
    {
      id: "holdsCustomer",
      from: "order",
      to: "customerId",
      type: "holds",
      label: "customer",
      description: "The customer who placed the order, referred to by a typed CustomerId.",
      code: "customerId",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Create a Money through its factory",
      description:
        "Creating a Money from 1000 cents and EUR checks that the amount is a whole number in range and that the currency is three capital letters, then returns 10.00 EUR. The same goes for a 2.50 EUR shipping fee.",
      highlight: ["client", "use", "money"],
      packets: [
        { relation: "use", label: "create 10.00 EUR" },
        { relation: "use", label: "10.00 EUR", reverse: true, after: 0 },
      ],
      notes: { money: "10.00 EUR" },
      code: "moneyCreate",
    },
    {
      title: "Invalid values are rejected at the door",
      description:
        "Creating a Money from -5 cents fails with 'amount must be a whole number of cents from 0 to 1000000000000000'. The factory refuses to produce an invalid Money, so nothing downstream needs to re-check.",
      highlight: ["client", "use", "money"],
      packets: [
        { relation: "use", label: "create -5 cents" },
        { relation: "use", label: "rejected ✗", reverse: true, after: 0 },
      ],
      notes: { money: "rejected: negative" },
      code: "moneyCreate",
    },
    {
      title: "Adding returns a new Money",
      description:
        "Adding the 2.50 EUR shipping to the 10.00 EUR price gives a new Money of 12.50 EUR. The price is still 10.00 EUR, because nothing was changed in place. The sum goes back through the same validation as any other amount.",
      highlight: ["client", "use", "money"],
      packets: [
        { relation: "use", label: "add 2.50 EUR" },
        { relation: "use", label: "12.50 EUR (new)", reverse: true, after: 0 },
      ],
      notes: { money: "price 10.00 · total 12.50" },
      code: "moneyAdd",
    },
    {
      title: "Mixed currencies refuse to add",
      description:
        "Adding 1.00 USD to a EUR amount fails with 'cannot add USD to EUR'. The rule is written once, inside Money, instead of at every call site.",
      highlight: ["client", "use", "money"],
      packets: [
        { relation: "use", label: "add 1.00 USD" },
        { relation: "use", label: "rejected ✗", reverse: true, after: 0 },
      ],
      notes: { money: "rejected: USD ≠ EUR" },
      code: "moneyAdd",
    },
    {
      title: "Equal by value, not by identity",
      description:
        "A freshly created 12.50 EUR is a different object from the total, yet comparing them says they are equal because the amount and currency match. They are interchangeable.",
      highlight: ["client", "use", "money"],
      packets: [
        { relation: "use", label: "compare to 12.50 EUR" },
        { relation: "use", label: "true", reverse: true, after: 0 },
      ],
      notes: { money: "12.50 EUR = 12.50 EUR" },
      code: "moneyEquals",
    },
    {
      title: "An entity holds typed ids and a Money",
      description:
        "Checkout builds Order o-1 for customer c-1 with the 12.50 EUR total. The order is an entity: its OrderId is what identifies it, while the Money total and both ids are value objects.",
      highlight: ["client", "place", "order", "holdsTotal", "holdsId", "holdsCustomer"],
      packets: [{ relation: "place", label: "Order(o-1, c-1, 12.50 EUR)" }],
      notes: { orderId: "o-1", customerId: "c-1", order: "total 12.50 EUR" },
      code: "order",
    },
    {
      title: "Swapping the ids does not compile",
      description:
        "Passing the CustomerId where the OrderId belongs is a type error, even though both wrap a string. In Python, a type checker such as mypy reports it. The mix-up is caught before the program runs.",
      highlight: ["order", "holdsId", "orderId", "holdsCustomer", "customerId"],
      notes: { order: "Order(c-1, o-1) ✗", orderId: "expects OrderId" },
      code: "idSwap",
    },
    {
      title: "Values, not identities",
      description:
        "Money and the ids are defined by what they hold: created valid, never changed, equal when their values are equal. Order is defined by its id. Keeping that distinction clear is the core of the pattern.",
      highlight: ["money", "orderId", "customerId", "order"],
      code: "money",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
