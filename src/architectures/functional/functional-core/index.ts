import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { FunctionalCoreVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "functional-core",
  name: "Functional Core, Imperative Shell",
  paradigm: "functional",
  order: 6,
  summary:
    "Keep all the decisions in pure functions on plain data, and push every side effect out to a thin shell.",
  intent:
    "Put business decisions in pure functions that take plain values and return plain values. The core describes side effects as data instead of performing them. A thin outer shell handles I/O, such as database, HTTP, clock, and email calls.",
  problem:
    "A reminder job may read the clock, load a database record, decide whether to act, send an email, and save a change, all in one method. Testing the decision then requires a database, a fake clock, and a way to catch outgoing email, even though the rule itself is just a few conditions.",
  solution:
    'Split the code into a pure core and an outer shell. The core takes an account and the current time, then returns a decision and a list of effects, such as an email to send. It does not access the database, clock, or network. The shell loads the account, reads the clock, calls the core, and performs the returned effects. Gary Bernhardt named this approach in his 2012 Destroy All Software screencast "Functional Core, Imperative Shell" and expanded on it in his "Boundaries" talk: keep decisions separate from I/O and connect them with plain values.',
  analogy:
    "A judge and a bailiff. The judge (the core) only ever looks at the facts of the case and hands down a ruling — 'enforce this fine' — without personally going to collect the money. The bailiff (the shell) carries out whatever the ruling says: visiting addresses, making phone calls, filing paperwork. You can replay the same facts past the judge a thousand times in a quiet room and always get the same ruling; only the bailiff ever has to leave the building.",
  whenToUse: [
    "The valuable, change-prone part of the system is a decision or calculation, and the I/O around it is comparatively simple and stable.",
    "You want to unit-test business rules with plain values and assertions, with no test doubles, in-memory databases, or time-travel tricks for the clock.",
    "Any language works (Bernhardt's original screencast used Ruby); it is easiest where immutable values and sum types or pattern matching are cheap (F#, Elm, Elixir, modern C# and TypeScript).",
    "Multiple different shells need to reuse the same rule — an HTTP handler, a scheduled job, and a CLI command all calling the same pure core.",
  ],
  pros: [
    "The core is trivial to test: call the function with plain values, assert on the plain value (including the list of effects) it returns. No mocks, no fakes, no sequencing of expectations.",
    "Side effects become data, which means they can be logged, replayed, counted or asserted on before they ever touch a real system.",
    "Pure functions are referentially transparent — safe to memoize, run in parallel, or call many times without consequence — which the imperative shell by definition can never be.",
    "Moving business logic out of handlers, jobs and controllers tends to surface duplicated rules that were previously hidden inside separate shells.",
  ],
  cons: [
    "The core can't just call `sendEmail()` when it decides to — it has to hand back a description of that email and trust the shell to actually send it, which means the shell's interpreter has to stay in lockstep with every effect type the core can produce.",
    'Pushing all I/O to the edges can mean the shell ends up repeating the same "gather inputs, call core, interpret effects" shape over and over across every entry point.',
    "Representing complex, branching side effects purely as data can become its own small interpreter language, which is extra ceremony for simple cases.",
    "Getting there can take real effort in OO codebases built around stateful services and mutation: each slice has to be untangled from its I/O before its decisions can be extracted into a pure function.",
  ],
  realWorld: [
    'Gary Bernhardt named this split in his 2012 Destroy All Software screencast "Functional Core, Imperative Shell" and expanded on it in the "Boundaries" talk (SCNA 2012)',
    "Redux reducers are a pure core (`(state, action) => state`) with all I/O pushed into middleware and effects at the edges",
    "Elm enforces this split at the language level, and re-frame (ClojureScript) encourages it: Elm's \"update\" function is pure, re-frame's event handlers return effects as data",
    "Event-sourced systems' `decide`/`evolve` functions are themselves a pure core, with the event store and projections forming the shell",
  ],
  concepts: [
    {
      term: "Pure function",
      description:
        "A function whose output depends only on its inputs, with no side effects — it never reads a clock, calls a database, or mutates anything outside itself.",
    },
    {
      term: "Side effect",
      description:
        "Anything a function does besides compute and return a value: writing to a database, sending a request, mutating shared state, reading the current time.",
    },
    {
      term: "Referential transparency",
      description:
        "The property that a pure function call can be replaced by its return value without changing the program's behavior — what makes pure code trivial to test and reason about.",
    },
    {
      term: "Effects as data",
      description:
        "Instead of performing an effect, the core returns a plain value describing it (e.g. `{ type: 'sendEmail', … }`), which the shell later interprets and performs.",
    },
    {
      term: "Imperative shell",
      description:
        "The thin, deliberately boring layer that does all the actual I/O: loading inputs for the core and carrying out the effects it returns. It contains orchestration, not business rules.",
    },
    {
      term: "Interpreter (the shell)",
      description:
        "The part of the shell that walks the list of effects the core returned and performs each one — similar in spirit to the Interpreter design pattern: the effect types form a tiny language that the shell interprets.",
    },
    {
      term: "Immutability",
      description:
        "Core data (accounts, decisions, effects) is never mutated in place — a change produces a new value, which keeps the core's inputs and outputs safe to pass around, log, or compare.",
    },
    {
      term: "Boundary",
      description:
        "The explicit seam between the pure core and the imperative shell, where plain values cross in one direction and effect descriptions cross back the other — the idea Gary Bernhardt's talk is named for.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "command",
        why: 'The effects the core returns — "send this email", "mark this account reminded" — are Command objects in everything but name: self-contained descriptions of an action to perform later.',
      },
      {
        slug: "interpreter",
        why: "The imperative shell walks the list of effects the core returned and performs each one — similar in spirit to Interpreter: the effect types form a tiny language that the shell interprets.",
      },
      {
        slug: "dependency-injection",
        why: "The shell takes its clock, account store and mailer as constructor or function parameters rather than constructing them itself — classic DI, just without necessarily needing a container to wire it.",
      },
    ],
    architectures: [
      {
        slug: "hexagonal",
        why: "Hexagonal draws the same core/edge boundary around ports and adapters; Functional Core, Imperative Shell is one natural way to implement the inside of that hexagon, with the shell playing the role of the adapters.",
      },
      {
        slug: "cqrs",
        why: "A command handler is itself naturally split into a pure decision step (given the current state and the command, what should happen) and a thin imperative shell that loads the state and applies the result.",
      },
      {
        slug: "event-sourcing",
        why: "`decide(command, state) => events` and `evolve(state, event) => state` are already a pure core; the append-only event store and its projections are the imperative shell built around them.",
      },
      {
        slug: "mvu",
        why: "MVU is Functional Core, Imperative Shell applied to a whole application loop: update and view are the pure core, and the runtime that dispatches messages, performs commands and notifies subscribers is the imperative shell around them.",
      },
      {
        slug: "pipes-and-filters",
        why: "A pipes-and-filters pipeline is a functional core taken to its logical extreme: every stage (parseLines, validateLines, addLineTotal, applyDiscount, addTax, formatLines) is a pure function with no I/O, and the only impure code is the trace logging wrapped around the stages and the final loop that drives the pipeline and prints its output — the imperative shell.",
      },
    ],
  },

  // Diagram (viewBox 800 × 460, x/y are box centres)
  viewBox: "0 0 800 460",
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 660,
      y: 70,
      description:
        "A browser or scheduler triggering the reminder check over HTTP. It only ever talks to the shell's handler, never to the core directly.",
    },
    {
      id: "handler",
      label: "ReminderHandler",
      role: "Imperative shell · entry point",
      kind: "class",
      x: 400,
      y: 70,
      width: 190,
      description:
        "Gathers plain inputs (the account, the current time), calls the pure core, and then interprets whatever effects it returns by performing the matching I/O.",
      patterns: ["interpreter", "dependency-injection"],
    },
    {
      id: "clock",
      label: "Clock",
      role: "Imperative shell · adapter",
      kind: "interface",
      x: 630,
      y: 230,
      width: 150,
      description:
        "A tiny adapter around the system clock. The shell calls it once, up front, and hands the resulting `now` into the core as a plain value.",
    },
    {
      id: "core",
      label: "decideReminder()",
      role: "Pure core",
      kind: "object",
      x: 400,
      y: 230,
      width: 170,
      description:
        "A pure function: (account, now) → Decision. No clock reads, no database calls, no network requests — just plain data in, plain data (including effects) out.",
      patterns: ["command"],
    },
    {
      id: "mailer",
      label: "Mailer",
      role: "Imperative shell · adapter",
      kind: "interface",
      x: 170,
      y: 230,
      width: 150,
      description:
        "The shell's adapter for sending email. It is only ever called while the shell is interpreting a `sendEmail` effect returned by the core.",
    },
    {
      id: "accounts",
      label: "AccountStore",
      role: "Imperative shell · adapter",
      kind: "interface",
      x: 400,
      y: 390,
      width: 180,
      description:
        "The shell's adapter over the database: loads the account before calling the core, and saves it again if the core's decision says to mark it reminded.",
    },
    {
      id: "test",
      label: "TestHarness",
      role: "Test code",
      kind: "client",
      x: 660,
      y: 390,
      description:
        "A unit test. It calls the core directly with plain values — a literal account, a literal date — and asserts on the plain Decision it gets back. No shell, no mocks.",
    },
  ],
  relations: [
    {
      id: "request",
      from: "client",
      to: "handler",
      type: "calls",
      label: "POST /reminders/run",
      description:
        "A request (or a scheduled trigger) asks the shell to run the reminder check for one account.",
      code: "shell",
    },
    {
      id: "loadAccount",
      from: "handler",
      to: "accounts",
      type: "calls",
      label: "accounts.load(id)",
      description:
        "The shell loads the account it needs before calling the core — a plain value gathered up front.",
      code: "shell",
    },
    {
      id: "readClock",
      from: "handler",
      to: "clock",
      type: "calls",
      label: "clock.now()",
      description:
        "The shell reads the current time once, before calling the core, and treats it from then on as a plain value rather than reaching for the clock again later.",
      code: "shell",
    },
    {
      id: "decide",
      from: "handler",
      to: "core",
      type: "calls",
      label: "decideReminder(account, now)",
      description:
        "The shell hands the core exactly two plain values and nothing else. The core reads nothing from the outside world beyond its arguments.",
      bend: -40,
      code: "core",
    },
    {
      id: "sendEmail",
      from: "handler",
      to: "mailer",
      type: "calls",
      label: "interpret: sendEmail",
      description:
        "Back in the shell, a `sendEmail` effect in the Decision is interpreted by actually calling the mailer.",
      code: "shell",
    },
    {
      id: "markReminded",
      from: "handler",
      to: "accounts",
      type: "calls",
      label: "interpret: markReminded",
      description:
        "A `markReminded` effect is interpreted by saving the account back with its `lastReminderAt` updated — the only write the whole run performs.",
      bend: 40,
      code: "shell",
    },
    {
      id: "testCall",
      from: "test",
      to: "core",
      type: "calls",
      label: "decideReminder(account, now)",
      description:
        "The test calls the pure core directly, cutting straight across the shell entirely, with a literal account and a literal date — no server, no database, no fake clock class.",
      bend: 30,
      code: "test",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "A pure core, ringed by an imperative shell",
      description:
        "decideReminder() sits at the centre, untouched by I/O. Everything that actually talks to the outside world — the HTTP handler, the clock, the account store, the mailer — lives in the imperative shell around it.",
      highlight: ["client", "handler", "clock", "core", "mailer", "accounts"],
    },
    {
      title: "The shell loads the account",
      description:
        "A request reaches ReminderHandler. The first thing it does is load the Account it needs from the store — a plain value, gathered before the core is ever called.",
      highlight: ["client", "request", "handler", "loadAccount", "accounts"],
      packets: [
        { relation: "request", label: "POST /reminders/run" },
        { relation: "loadAccount", label: "load(id)", after: 0 },
      ],
      notes: { accounts: "Account loaded" },
      code: "shell",
    },
    {
      title: "The shell reads the clock",
      description:
        "Next, the handler reads the current time from the Clock — once, before the core is called — and turns it into another plain value.",
      highlight: ["handler", "readClock", "clock"],
      packets: [{ relation: "readClock", label: "now()" }],
      notes: { clock: "now: plain Date" },
      code: "shell",
    },
    {
      title: "The shell calls the core with plain values",
      description:
        "ReminderHandler calls decideReminder(account, now). That is the entire boundary: two plain values go in, and nothing about the database, the clock, or the network crosses it.",
      highlight: ["handler", "decide", "core"],
      packets: [{ relation: "decide", label: "decideReminder(account, now)" }],
      notes: { core: "computing…" },
      code: "core",
    },
    {
      title: "The core decides — and returns effects as data",
      description:
        "The core checks whether the invoice is overdue and whether a reminder already went out today, then returns a Decision: an action, and a list of effects to perform. It does not send the email or write to the database itself — it only describes what should happen.",
      highlight: ["core", "decide"],
      packets: [
        {
          relation: "decide",
          label: "{ action: remind, effects: [sendEmail, markReminded] }",
          reverse: true,
        },
      ],
      notes: { core: "2 effects returned" },
      code: "core",
    },
    {
      title: 'The shell interprets the "sendEmail" effect',
      description:
        "Back in control, ReminderHandler walks the effects list. The first one is a sendEmail description, so it calls the real Mailer with the fields from that effect.",
      highlight: ["handler", "sendEmail", "mailer"],
      packets: [{ relation: "sendEmail", label: "send(to, subject, body)" }],
      notes: { mailer: "email sent" },
      code: "shell",
    },
    {
      title: 'The shell interprets the "markReminded" effect',
      description:
        "The second effect is a markReminded description. The handler interprets it by saving the account back with lastReminderAt updated — the one write the whole run performs.",
      highlight: ["handler", "markReminded", "accounts"],
      packets: [{ relation: "markReminded", label: "save(account)" }],
      notes: { accounts: "lastReminderAt updated" },
      code: "shell",
    },
    {
      title: "Testing the core needs no mocks",
      description:
        "A unit test calls decideReminder() directly with a literal account and a literal date, cutting straight past the entire shell, and asserts on the Decision it gets back — no server, no real database, no fake clock class, just values.",
      highlight: ["test", "testCall", "core"],
      packets: [{ relation: "testCall", label: "decideReminder(account, now)" }],
      notes: { core: "same input → same output", test: "assert on Decision" },
      code: "test",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: FunctionalCoreVisualization,
};
