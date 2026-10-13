/**
 * The Actor Model and Event-Driven Architecture both move work around as asynchronous messages
 * that wait in a queue, which is why they are easy to mix up. The difference is who a message is
 * for: an actor message goes to one named receiver, an event goes to whoever subscribed. Every
 * claim below was checked against `src/architectures/both/actor-model` and
 * `src/architectures/both/event-driven` (index.ts and all four language examples), not against
 * the two ideas in the abstract. Both examples run on a single thread in a fixed order so they
 * print the same output in every language; neither one shows real concurrency.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "actor-model-vs-event-driven",
  title: "Actor Model vs Event-Driven",
  order: 9,
  summary:
    "Both queue asynchronous messages. An actor is told something by name and owns its state; an event is published as a fact to whoever subscribed.",
  subjects: [
    { kind: "architecture", slug: "actor-model" },
    { kind: "architecture", slug: "event-driven" },
  ],
  problem:
    "A system needs its parts to talk without calling each other and waiting: an account has to handle deposits and withdrawals, and other parts have to react when an order is placed. Both subjects send asynchronous messages through queues, but they answer different questions: who is this message for, and who owns the state that it changes?",
  constraints: [
    "Does the sender mean one specific receiver (“account, handle this”), or is it announcing something that happened to whoever cares (“order 1 was placed”)?",
    "Must the sender know who receives the message, or must it stay unaware of them, so that receivers can be added or removed without touching it?",
    "Is there state that must be changed by one owner, one message at a time, so that nobody sees it half updated?",
    "When a receiver fails, should a parent decide what happens next, or is failure left to the receivers themselves?",
    "Is it enough that each queue is first in, first out, or does the order between different receivers matter?",
  ],
  dimensions: [
    {
      label: "Addressing",
      values: {
        "actor-model":
          "By name. The usage code tells the actor named account and gives the actor named teller as the reply-to address. A message goes into one mailbox, and a name that does not exist is reported by throwing an exception (a panic in Go).",
        "event-driven":
          "By topic. OrdersProducer publishes OrderPlaced under a topic name, and the broker calls every handler subscribed to it, in subscription order: three at first, four after LoyaltyConsumer subscribes. A topic with no subscriber, like StockReserved here, is delivered to nobody and nothing fails.",
      },
    },
    {
      label: "What a message means",
      values: {
        "actor-model":
          "A request to its receiver: Deposit, Withdraw and GetBalance say what the sender wants done, and carry a reply-to address because there is no return value.",
        "event-driven":
          "A fact in the past tense: OrderPlaced and StockReserved say that something happened. The producer does not expect any particular consumer to act on it.",
      },
    },
    {
      label: "State ownership",
      values: {
        "actor-model":
          "The state belongs to one actor. The account’s balance is held inside AccountActor, and code outside reaches it only by putting a message in the account’s mailbox, so there are no locks around it in this example.",
        "event-driven":
          "The model does not give state an owner. In this example the consumers each keep their own state (AnalyticsConsumer’s running count, the order ids that the dedupe wrapper has seen), and the event carries data to them. Nothing in the example arranges for one owner to handle one change at a time.",
      },
    },
    {
      label: "Processing order",
      values: {
        "actor-model":
          "Each actor has its own first in, first out mailbox and handles one message per turn. The scheduler goes round the actors in spawn order, so the teller prints a reply while the account handles its next message: Round 2 shows the two interleaved.",
        "event-driven":
          "One shared first in, first out queue. drain takes one event and calls all of its handlers in subscription order before it takes the next. An event published during a handler, like StockReserved, goes to the back of the queue, and Analytics still handles OrderPlaced before StockReserved is taken.",
      },
    },
    {
      label: "Failure handling",
      values: {
        "actor-model":
          "Built in. When the account fails on Deposit 0.00, the system drops that message, suspends the account and sends a Failed message to its parent. SupervisorActor restarts the account (one-for-one), the waiting GetBalance is answered by the new instance, and the teller keeps working. The restart gives the account a fresh balance of 0.00.",
        "event-driven":
          "None in this example. The loop that calls the handlers contains no error handling and no consumer fails, so the example does not show what happens to the other consumers or to the remaining events. A failing handler would escape from drain to its caller (in Go as a panic). Retries, dead-letter queues and the like are not in the example, only the page’s discussion of delivery guarantees.",
      },
    },
    {
      label: "Coupling",
      values: {
        "actor-model":
          "The sender needs the receiver’s name and the message shapes. The account in turn does not know the teller: it only tells whatever reply-to address it was given. Senders are tied to that name.",
        "event-driven":
          "The producer needs the broker, a topic name and the event shape, and nothing else. It is never changed when a consumer is added: LoyaltyConsumer subscribes after the first order and OrdersProducer stays untouched.",
      },
    },
    {
      label: "Cost",
      values: {
        "actor-model":
          "A request and its answer are two messages, and the answer arrives later at another actor, so the main program in the example never receives one. A restart starts the actor from nothing, which is why the 75.00 balance is gone and nothing persists it.",
        "event-driven":
          "What happens after an event is spread over the consumers, so reading the publish call does not show the whole flow. The queue is also not durable: dedupe remembers order ids only in memory, and the redelivered order 1 still reaches Email and Analytics a second time.",
      },
    },
  ],
  options: [
    {
      subject: "actor-model",
      changes:
        "The usage code spawns SupervisorActor, TellerActor and AccountActor, and tells messages to the account by name. The ActorSystem keeps one mailbox per actor and gives each actor one message per turn, so the balance is changed by one message at a time. The sender never waits: the account answers by telling the teller. When the account crashes, its supervisor restarts it.",
      chooseWhen: [
        "There are many separate things (accounts, sessions, devices) that each own state and receive requests meant for that one thing.",
        "State must be changed by one owner, one message at a time, without a lock around it.",
        "Failure should be contained: a bad message should restart one part, and a supervisor should decide how.",
        "The sender should be able to carry on without waiting for the receiver to finish.",
      ],
      code: [
        { kind: "architecture", slug: "actor-model", region: "actorSystem" },
        { kind: "architecture", slug: "actor-model", region: "account" },
        { kind: "architecture", slug: "actor-model", region: "supervisor" },
      ],
      steps: [
        { kind: "architecture", slug: "actor-model", step: 1 },
        { kind: "architecture", slug: "actor-model", step: 6 },
        { kind: "architecture", slug: "actor-model", step: 7 },
      ],
    },
    {
      subject: "event-driven",
      changes:
        "OrdersProducer publishes OrderPlaced to a topic on EventBroker and moves on. The broker delivers it to every subscribed consumer (Email, Inventory, Analytics, and later Loyalty), none of which the producer knows. A consumer can publish a further event on its own, as Inventory does with StockReserved. The example has no supervision and no per-receiver mailbox.",
      chooseWhen: [
        "Several independent parts must react to the same fact, and that list keeps growing.",
        "The producer should not know, or be changed by, who reacts to what it announces.",
        "Reactions may happen later and do not need to be part of the same step that caused the event.",
        "Each reaction is its own decision, and there is no need for one owner of a piece of state.",
      ],
      code: [
        { kind: "architecture", slug: "event-driven", region: "broker" },
        { kind: "architecture", slug: "event-driven", region: "producer" },
        { kind: "architecture", slug: "event-driven", region: "usage" },
      ],
      steps: [
        { kind: "architecture", slug: "event-driven", step: 3 },
        { kind: "architecture", slug: "event-driven", step: 5 },
        { kind: "architecture", slug: "event-driven", step: 7 },
      ],
    },
  ],
  noPattern: {
    when: "One caller needs one result from one component, in order, and the caller can wait for it. Nothing needs to be queued, and no state is shared between concurrent callers.",
    instead:
      "Call the function or method directly and use its return value. Add a queue, a mailbox or a broker only when the caller must not wait, or when something else needs to react.",
  },
  overlap:
    "These are different tools, and they can be combined. A system can use actors where a piece of state needs one owner and a supervisor, and use events where other parts need to react without being named. In the Actor Model example a tell names one receiver. In the Event-Driven example a publish names a topic. The two examples are close in how they queue: in both, the call that sends only adds to a queue, and a loop delivers the messages first in, first out on one thread. They differ in who receives, in the per-actor mailboxes and supervisor on one side, and in the shared queue with no failure handling on the other. Neither example uses the other: the actors do not publish to a broker, and the broker does not address an actor.",
  scenario: {
    prompt:
      "Deposits and withdrawals for many accounts arrive at the same time. The team wants each account’s balance to be changed by one request at a time and never seen half updated, and wants a bad request to restart that one account without stopping the others. Which fits?",
    choices: [
      {
        id: "actor-per-account",
        option: "actor-model",
        label: "Make each account an actor and send requests to it by name",
        verdict: "best",
        explanation:
          "This is what the Actor Model example does. The balance belongs to the account, which handles one message per turn, so it is never seen half updated, and no lock is needed. A zero deposit crashes only that account, and its supervisor restarts it, as in the example. The restarted balance is lost, so persist it if it must survive.",
      },
      {
        id: "events-to-accounts",
        option: "event-driven",
        label: "Publish each request as an event and let account handlers subscribe to it",
        verdict: "poor",
        explanation:
          "A deposit is a request for one particular account, not a fact for anyone to react to. The Event-Driven example calls every subscriber of a topic in turn, and nothing in it lets one owner handle each change to a piece of state, one at a time. The example also has no failure handling: the loop that calls the handlers has no way to restart one failing consumer.",
      },
      {
        id: "lock-and-call",
        option: "none",
        label: "Call the account directly and put a lock around the balance",
        verdict: "workable",
        explanation:
          "A lock does keep the balance from being seen half updated, and it is the simplest answer when there are few accounts. The cost is that callers wait, and every caller has to take the lock correctly. A failing call lands in code that does not know how to recover. The actor’s queue and supervisor take over those two jobs.",
      },
      {
        id: "actors-and-broker",
        label: "Actors for the accounts and a broker that announces every change",
        verdict: "workable",
        explanation:
          "These can work together, and it is a good design if other parts need to react to deposits. The requirement as stated does not need it, though: the actors alone already give one-at-a-time changes and supervision. A broker adds a shared queue, with its own failure questions, before anything has asked for it.",
      },
    ],
  },
};
