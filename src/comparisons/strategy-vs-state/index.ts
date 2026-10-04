/**
 * Strategy and State share the exact same class diagram — a context holding an interface, with
 * concrete classes behind it — which is why they are so often confused. Every claim below was
 * checked against `src/patterns/behavioral/strategy` and `src/patterns/behavioral/state`
 * (index.ts and all four language examples) rather than against the pattern in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "strategy-vs-state",
  title: "Strategy vs State",
  order: 1,
  summary:
    "Both use similar class diagrams. The key difference is who chooses the behavior: the caller or the object itself?",
  subjects: [
    { kind: "pattern", slug: "strategy" },
    { kind: "pattern", slug: "state" },
  ],
  problem:
    "An object has several interchangeable implementations of its behavior — a route calculator with three algorithms, a document whose workflow has several stages — and a big if/else (or switch) picking between them has started to rot.",
  constraints: [
    "Who decides which variant is active: something outside the object, or the object itself?",
    "Do the variants need to know about each other, or are they fully independent?",
    "Does the variant change constantly over the object’s lifetime, or is it set once and left alone?",
    "How many variants are there, and is that count stable?",
  ],
  dimensions: [
    {
      label: "Intent",
      values: {
        strategy:
          "Make an algorithm interchangeable, so the code that uses it never has to change.",
        state: "Let an object change its own behavior by swapping which state object defines it.",
      },
    },
    {
      label: "Who triggers a switch",
      values: {
        strategy:
          "The client: it calls setStrategy() with a different implementation whenever it chooses to.",
        state:
          "From inside the object. In this example the current state object's method returns the next state, and the context just stores whatever comes back (GoF also allows the Context to own the transitions).",
      },
    },
    {
      label: "Do variants know each other",
      values: {
        strategy:
          "No — FastestRoute, ShortestRoute and ScenicRoute have no reference to one another.",
        state: "Yes — InReviewState names and creates PublishedState or RejectedState directly.",
      },
    },
    {
      label: "Lifetime of the active variant",
      values: {
        strategy:
          "Usually set once (or swapped rarely by explicit choice) and reused for many calls.",
        state: "Expected to change repeatedly — every handled action can replace it.",
      },
    },
    {
      label: "Typical variant count",
      values: {
        strategy: "A handful of algorithms, usually stable once written.",
        state: "One class per stage in the workflow; grows as the workflow gains stages.",
      },
    },
    {
      label: "Class diagram",
      values: {
        strategy:
          "Context → Strategy interface ← concrete strategies. Nearly identical to State’s.",
        state: "Context → State interface ← concrete states. Nearly identical to Strategy’s.",
      },
    },
  ],
  options: [
    {
      subject: "strategy",
      changes:
        "Navigator holds a RouteStrategy and delegates route() to it. Calling setStrategy() with a different implementation changes what the exact same route() call does, without the Navigator’s code ever branching on which one is active.",
      chooseWhen: [
        "The variant is chosen from outside the object — by configuration, by a caller, or by the end user.",
        "The variants are interchangeable and genuinely independent of one another.",
        "New variants should be addable without touching the context (Open/Closed).",
      ],
      code: [
        { kind: "pattern", slug: "strategy", region: "holds" },
        { kind: "pattern", slug: "strategy", region: "setStrategy" },
      ],
      steps: [
        { kind: "pattern", slug: "strategy", step: 2 },
        { kind: "pattern", slug: "strategy", step: 4 },
      ],
    },
    {
      subject: "state",
      changes:
        "Document holds a DocumentState and forwards every action to it. DraftState.submit() does not just do work — it returns a new InReviewState, and Document stores it. The decision of what comes next is made inside the state object, not by Document or by whoever called submit().",
      chooseWhen: [
        "The variant must change itself as a side effect of handling a request.",
        "The legal transitions form a graph you want enforced in one place, not scattered across every caller.",
        "Callers shouldn’t need to know which actions are valid from the current stage — an invalid one can just be absorbed.",
      ],
      code: [
        { kind: "pattern", slug: "state", region: "holds" },
        { kind: "pattern", slug: "state", region: "submit" },
      ],
      steps: [
        { kind: "pattern", slug: "state", step: 2 },
        { kind: "pattern", slug: "state", step: 4 },
      ],
    },
  ],
  noPattern: {
    when: "Two or three fixed variants that never grow, with nobody needing to swap them at runtime.",
    instead:
      "For Strategy, use a switch or a map of functions while there are only a few stateless options. For State, use an enum and a switch or transition table while each stage has little behavior. Use the patterns when the options need their own state or the stage-specific behavior grows.",
  },
  overlap:
    "A State can use a Strategy internally, and both patterns use a context that holds an interface. The difference is who changes the behavior: an outside caller chooses a Strategy, while State changes the behavior from inside the object — usually, as in this example, by each state choosing its successor (GoF also allows the Context to own the transitions).",
  scenario: {
    prompt:
      "A checkout page needs to let the shopper pay by card, PayPal or invoice. Which fits best?",
    choices: [
      {
        id: "strategy",
        option: "strategy",
        label: "Strategy — one PaymentMethod interface, chosen by the client",
        verdict: "best",
        explanation:
          "The shopper picks a payment method explicitly, the three methods don’t need to know about each other, and nothing transitions on its own — exactly the shape Strategy is for: an interchangeable algorithm, chosen from outside.",
      },
      {
        id: "function-map",
        option: "none",
        label: "A plain function map — no pattern at all",
        verdict: "workable",
        explanation:
          "With three stable variants and no per-method state to manage, a lookup of payment-method name to a plain function does the job with less ceremony. Strategy’s extra classes start earning their keep once the variants grow, need their own constructor state, or want to be unit-tested in isolation.",
      },
      {
        id: "state",
        option: "state",
        label: "State — treat the payment method as internal state",
        verdict: "poor",
        explanation:
          "The payment method isn’t something the checkout transitions through on its own over its lifetime — it’s a single choice the shopper makes, used once. Modelling it as State adds self-transition machinery that nothing here ever triggers.",
      },
    ],
  },
};
