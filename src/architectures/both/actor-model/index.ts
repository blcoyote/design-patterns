import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { ActorModelVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "actor-model",
  name: "Actor Model",
  paradigm: "both",
  order: 16,
  summary:
    "Isolated actors that share nothing, own their state, and communicate only by asynchronous messages queued in mailboxes; each processes one message at a time, and supervisors restart actors that crash.",
  intent:
    "Build a system out of many small actors that each own their state privately and talk only by sending messages. A message is put in the receiver's mailbox and the sender carries on; the receiver handles its mailbox one message at a time. Because nothing is shared and nothing is called directly, there are no locks around an actor's state, and a failing actor can be dealt with by another actor (its supervisor) instead of taking its neighbours down.",
  problem:
    "Shared mutable state is hard to get right once several things run at the same time: two callers read the same balance, both decide, and both write. Locks fix that at the price of ordering rules nobody can see, deadlocks, and code that is only correct if every caller takes the lock. Synchronous calls add a second problem: the caller waits, so a slow or broken callee stalls it, and an exception thrown in the callee lands in code that does not know how to recover from it.",
  solution:
    "Make the unit of isolation an actor: a piece of state together with a mailbox and a handler. Code outside an actor holds only its address (here just its name), so the only way to reach the state is to put a message in the mailbox. The actor takes one message at a time, so its state needs no lock. Answers are messages too: a request carries a replyTo address and the sender never waits. Failure is handled the same way. When an actor crashes, the system drops the failing message, suspends the actor and tells its parent with a Failed message; the supervisor replaces the actor with a fresh instance. In this example one ActorSystem owns all the mailboxes and runs the actors in rounds on a single thread, in a fixed order. That keeps the output identical in every language: real runtimes (Erlang/OTP, Akka, Orleans, and Go with goroutines and channels) run actors concurrently.",
  analogy:
    "A bank branch where customers never reach into the vault. A teller hands a request slip to the vault clerk, who works through the slips in the order they arrived and sends a written answer back to the teller. Nobody waits at the clerk's desk. If the clerk collapses over a nonsense slip, the branch manager brings in a fresh clerk who starts with an empty notebook, and the slips still in the tray are dealt with by the new clerk.",
  whenToUse: [
    "Many independent entities (accounts, sessions, devices, game characters) each have their own state and receive a steady stream of requests.",
    "You want concurrency without locks around business state: one actor handles one message at a time, so it never sees another request half done.",
    "Failure is normal and should be contained: a bad input or a broken component should restart just that one part, and a supervisor should decide how.",
    "The work may need to spread over several machines later: an actor that is addressed by name and reached by message does not care whether its mailbox is in the same process.",
  ],
  pros: [
    "An actor's state needs no locks: it is private and only the actor itself touches it, one message at a time. In this example the balance is a private field that the account alone reads and writes.",
    "Senders never wait. tell only enqueues, so the four messages sent to the account are queued before any of them runs, and a slow actor delays its own mailbox, not its senders.",
    "Failures are contained and handled by structure. The account crashes on Deposit 0.00, the teller keeps working, and the supervisor restarts only the account (one-for-one).",
    "The same shape scales out. Actors are reached by address, so a runtime can place them in other processes or on other machines; Orleans and Akka Cluster do exactly that.",
  ],
  cons: [
    "Everything is asynchronous. A request and its answer are two messages, so a caller that needs a result has to carry a replyTo and handle the reply later; in this example the teller prints the answers, and the main program never receives one.",
    "Restarting an actor starts it from nothing. The account had 75.00 and has 0.00 after its restart, so state that must survive needs persistence (for example by replaying events) on top of the model.",
    "Behaviour is spread over message flows. What happened is only visible by following messages between actors, and in a real concurrent runtime the interleaving can differ from run to run, so debugging needs tracing of messages.",
    "Mailboxes are queues with no limit here: if senders are faster than an actor, its mailbox just grows. Real runtimes offer bounded mailboxes and back-pressure, which then raise their own design questions.",
    "There is no transaction across actors. A change that touches two actors is two messages, and nothing makes them succeed or fail together.",
  ],
  realWorld: [
    "Erlang/OTP is built on processes with mailboxes that communicate only by messages. Its supervisors restart failing processes using strategies such as one_for_one, which is the origin of the 'let it crash' style.",
    "Akka (JVM) and Akka.NET provide actors addressed by ActorRef, each with a mailbox and a supervisor strategy that decides whether a failing child is resumed, restarted or stopped.",
    "Microsoft Orleans offers virtual actors (grains): the runtime activates a grain on demand, in one of the servers (silos) of a cluster, and callers address it by identity.",
    "WhatsApp's server side is built on Erlang, a runtime designed around lightweight processes that send each other messages.",
  ],
  concepts: [
    {
      term: "Actor",
      description:
        "A unit that owns private state and handles one message per turn through a receive method. Here there are three: AccountActor (a private balance), TellerActor (prints the answers) and SupervisorActor (restarts failed children).",
    },
    {
      term: "Address (ActorRef)",
      description:
        "How one actor names another. Here it is just the actor's name, a string, so a sender never holds the actor object and the only way to reach one is to put a message in its mailbox.",
    },
    {
      term: "Mailbox",
      description:
        "The FIFO queue in front of each actor, kept by the system: an array, a Queue<T>, a deque or a slice, depending on the language. tell appends to the back and the scheduler takes from the front.",
    },
    {
      term: "Message",
      description:
        "A plain data record of what the sender wants (Deposit, Withdraw, GetBalance, Reply, and Failed from the system), modelled as a discriminated union, sealed records, frozen dataclasses or structs behind an interface. Requests carry a replyTo address instead of a return value.",
    },
    {
      term: "Scheduler (ActorSystem)",
      description:
        "Decides when each actor runs. Here it walks the actors in spawn order, round after round, and gives each one message per round. This is single-threaded on purpose, so the output is the same in every language; real runtimes run actors concurrently.",
    },
    {
      term: "Supervision (one-for-one)",
      description:
        "A parent watches its children. When one crashes, the supervisor restarts just that one and leaves its siblings alone, which is Erlang's one_for_one. A crash is a thrown exception in TypeScript, C# and Python and a returned error in Go.",
    },
    {
      term: "Let it crash",
      description:
        "The account does not defend against a Deposit of 0.00: it throws, the failing message is dropped, and the supervisor restarts the actor with fresh state. Business outcomes such as an insufficient balance are not crashes: they are ordinary replies.",
    },
  ],
  variants: [
    {
      name: "Virtual actors (Orleans)",
      description:
        "The runtime creates an actor when a message first arrives for its identity and places it on one of the servers, so callers never spawn or locate actors themselves. This example spawns its actors explicitly.",
    },
    {
      name: "Other supervision strategies",
      description:
        "One-for-one restarts only the failed child. Erlang/OTP also has one_for_all and rest_for_one, and Akka has an all-for-one strategy, which restart a group when one member fails. This example implements only one-for-one, and always restarts.",
    },
    {
      name: "Persistent actors",
      description:
        "An actor that stores its changes as events and replays them after a restart, so it comes back with its state. This example does not persist anything, and that is why its balance is 0.00 after the restart.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "command",
        why: "Every message is a command object: Deposit, Withdraw and GetBalance carry what the sender wants and are queued in the account's mailbox, to be executed later by their receiver. In the first run the four queued messages stay unexecuted until the scheduler gives the account its turns. The textbook pattern has an explicit invoker and receiver; here the mailbox plus scheduler is the invoker and the actor is the receiver.",
      },
    ],
    architectures: [],
  },

  viewBox: "0 0 1100 740",
  participants: [
    {
      id: "client",
      label: "main",
      role: "Client",
      kind: "client",
      x: 150,
      y: 470,
      width: 150,
      description:
        "The usage code. It creates the system, spawns the three actors in order (supervisor, teller, account with the supervisor as its parent) and tells messages to the account by name. It never holds an actor object, never waits for an answer and never prints one: the teller does that.",
      patterns: ["command"],
      code: "usage",
    },
    {
      id: "scheduler",
      label: "ActorSystem (scheduler)",
      role: "Scheduler",
      kind: "class",
      x: 220,
      y: 260,
      width: 210,
      description:
        "Owns every mailbox and decides when each actor runs. run walks a snapshot of the actors in spawn order, skips suspended ones, and gives every actor with mail exactly one message per round, until a round processes nothing. When an actor crashes it drops the failing message, suspends the actor and puts a Failed message in the parent's mailbox. It is single-threaded so the example prints the same output in every language; real runtimes run actors concurrently.",
      code: "actorSystem",
    },
    {
      id: "supervisorMailbox",
      label: "supervisor mailbox",
      role: "Mailbox",
      kind: "object",
      x: 560,
      y: 120,
      width: 190,
      description:
        "The supervisor's FIFO queue. In this example it receives only the Failed messages that the system sends when the account crashes.",
      code: "actorSystem",
    },
    {
      id: "supervisor",
      label: "SupervisorActor",
      role: "Supervisor",
      kind: "class",
      x: 850,
      y: 120,
      width: 180,
      description:
        "The account's parent. On a Failed message it prints which child crashed and why, and asks the system to restart that child: the one-for-one strategy (Erlang's one_for_one). It never touches the account's state, and its restart gives the account a new instance, so whatever was only in the old one's memory is gone.",
      code: "supervisor",
    },
    {
      id: "accountMailbox",
      label: "account mailbox",
      role: "Mailbox",
      kind: "object",
      x: 560,
      y: 360,
      width: 190,
      description:
        "The account's FIFO queue, kept by the system: messages are appended at the back by tell and taken from the front, one per round. Messages queued behind a crash stay in it until the account is restarted.",
      patterns: ["command"],
      code: "actorSystem",
    },
    {
      id: "account",
      label: "AccountActor",
      role: "Actor with private state",
      kind: "class",
      x: 850,
      y: 360,
      width: 180,
      description:
        "Owns a balance that nothing else can touch: the only way to read or change it is a message. It answers by telling replyTo and never prints. An insufficient balance is a normal reply, but a Deposit of zero or less is not defended against: it crashes (a thrown exception in TypeScript, C# and Python, a returned error in Go) and leaves the decision to its supervisor.",
      code: "account",
    },
    {
      id: "tellerMailbox",
      label: "teller mailbox",
      role: "Mailbox",
      kind: "object",
      x: 560,
      y: 600,
      width: 190,
      description: "The teller's FIFO queue. It holds the Reply messages that the account sends.",
      code: "actorSystem",
    },
    {
      id: "teller",
      label: "TellerActor",
      role: "Actor",
      kind: "class",
      x: 850,
      y: 600,
      width: 180,
      description:
        "Receives the answers and prints each one as [teller] followed by the text. It is the only actor that prints a reply, and it never touches the account's state: it knows only what the account chose to say.",
      code: "teller",
    },
  ],
  relations: [
    {
      id: "tell",
      from: "client",
      to: "accountMailbox",
      type: "calls",
      label: "tell",
      description:
        "tell only enqueues: the message is appended to the account's mailbox and the call returns at once. The account does not run, and the sender does not wait for an answer.",
      code: "usage",
    },
    {
      id: "nextMessage",
      from: "scheduler",
      to: "accountMailbox",
      type: "calls",
      label: "next message",
      description:
        "When the account's turn comes in a round, the scheduler takes the message at the front of its mailbox. Exactly one per turn.",
      code: "actorSystem",
    },
    {
      id: "receiveAccount",
      from: "accountMailbox",
      to: "account",
      type: "calls",
      label: "receive",
      description:
        "The scheduler hands that one message to the account's receive. The account finishes it before it is given another, so its balance is never seen half updated.",
      code: "actorSystem",
    },
    {
      id: "replyToTeller",
      from: "account",
      to: "tellerMailbox",
      type: "calls",
      label: "tell(Reply)",
      description:
        "The account answers by telling a Reply to the address in replyTo, which is the teller. It is an ordinary message: it waits in the teller's mailbox until the teller's turn.",
      code: "account",
    },
    {
      id: "receiveTeller",
      from: "tellerMailbox",
      to: "teller",
      type: "calls",
      label: "receive",
      description: "On its turn the teller takes the oldest Reply from its mailbox and prints it.",
      code: "actorSystem",
    },
    {
      id: "failed",
      from: "scheduler",
      to: "supervisorMailbox",
      type: "calls",
      label: "Failed",
      bend: 30,
      description:
        "When the account crashes, the system drops the failing message, suspends the account, and enqueues a Failed message (child and reason) in the parent's mailbox. The crashed actor itself sends nothing.",
      code: "actorSystem",
    },
    {
      id: "receiveSupervisor",
      from: "supervisorMailbox",
      to: "supervisor",
      type: "calls",
      label: "receive",
      description: "On its turn the supervisor takes the Failed message from its mailbox.",
      code: "actorSystem",
    },
    {
      id: "restart",
      from: "supervisor",
      to: "account",
      type: "creates",
      label: "restart",
      description:
        "The supervisor asks the system to restart the account: a fresh instance built by the same factory replaces the old one, the suspension is lifted and the restart counter goes up. The mailbox is kept, so waiting messages are handled by the new instance.",
      code: "supervisor",
    },
  ],

  steps: [
    {
      title: "Three isolated actors, one scheduler",
      description:
        "Each actor owns private state and has its own mailbox, and the dashed boxes mark that boundary: code outside reaches an actor only by putting a message in its mailbox. One scheduler decides who runs. The supervisor sits above the account as its parent, so supervision forms a tree.",
      highlight: [
        "client",
        "scheduler",
        "supervisor",
        "supervisorMailbox",
        "account",
        "accountMailbox",
        "teller",
        "tellerMailbox",
      ],
      notes: { scheduler: "runs in spawn order", account: "private balance" },
    },
    {
      title: "tell only enqueues",
      description:
        "main tells the account four messages: Deposit 100.00, Withdraw 25.00, Withdraw 200.00 and GetBalance, each with the teller as replyTo. Each call just appends to the mailbox and returns, so main prints 'account mailbox: 4 messages, none processed yet': nothing has run.",
      highlight: ["client", "tell", "accountMailbox"],
      packets: [
        { relation: "tell", label: "Deposit 100.00" },
        { relation: "tell", label: "Withdraw 25.00", after: 0 },
        { relation: "tell", label: "Withdraw 200.00", after: 1 },
        { relation: "tell", label: "GetBalance", after: 2 },
      ],
      notes: { accountMailbox: "4 queued", account: "balance 0.00" },
      code: "usage",
    },
    {
      title: "Round 1: one message for the account",
      description:
        "run starts the first round. The supervisor and the teller have no mail, so they are skipped. The account is given exactly one message, the Deposit 100.00. Its private balance becomes 100.00, and it answers by telling a Reply to the teller's mailbox. The other three messages keep waiting.",
      highlight: [
        "scheduler",
        "nextMessage",
        "accountMailbox",
        "receiveAccount",
        "account",
        "replyToTeller",
        "tellerMailbox",
      ],
      packets: [
        { relation: "nextMessage", label: "next: Deposit 100.00" },
        { relation: "receiveAccount", label: "receive(Deposit)", after: 0 },
        { relation: "replyToTeller", label: "Reply: deposit ok", after: 1 },
      ],
      notes: { account: "balance 100.00", accountMailbox: "3 queued", tellerMailbox: "1 queued" },
      code: "actorSystem",
    },
    {
      title: "Round 2: interleaving",
      description:
        "In the next round the teller comes first in spawn order and prints the deposit reply, then the account handles its next message, Withdraw 25.00, and its balance becomes 75.00. Each actor handles one message per round, so the two make progress side by side while the account's mailbox still holds two messages.",
      highlight: [
        "tellerMailbox",
        "receiveTeller",
        "teller",
        "scheduler",
        "nextMessage",
        "accountMailbox",
        "receiveAccount",
        "account",
        "replyToTeller",
      ],
      packets: [
        { relation: "receiveTeller", label: "receive(Reply)" },
        { relation: "nextMessage", label: "next: Withdraw 25.00", after: 0 },
        { relation: "receiveAccount", label: "receive(Withdraw)", after: 1 },
        { relation: "replyToTeller", label: "Reply: withdraw ok", after: 2 },
      ],
      notes: {
        teller: "prints deposit reply",
        account: "balance 75.00",
        accountMailbox: "2 queued",
        tellerMailbox: "1 queued",
      },
      code: "actorSystem",
    },
    {
      title: "Round 3: a rejection is a normal reply",
      description:
        "The teller prints the withdraw 25.00 reply. The account gets Withdraw 200.00, which is more than its 75.00. That is a business outcome, not a crash: it tells the teller 'withdraw 200.00 rejected, balance 75.00' and its balance stays 75.00.",
      highlight: [
        "tellerMailbox",
        "receiveTeller",
        "teller",
        "scheduler",
        "nextMessage",
        "accountMailbox",
        "receiveAccount",
        "account",
        "replyToTeller",
      ],
      packets: [
        { relation: "receiveTeller", label: "receive(Reply)" },
        { relation: "nextMessage", label: "next: Withdraw 200.00", after: 0 },
        { relation: "receiveAccount", label: "receive(Withdraw)", after: 1 },
        { relation: "replyToTeller", label: "Reply: rejected", after: 2 },
      ],
      notes: {
        teller: "prints withdraw 25.00 ok",
        account: "rejected, still 75.00",
        accountMailbox: "1 queued",
        tellerMailbox: "1 queued",
      },
      code: "account",
    },
    {
      title: "GetBalance: asking by replyTo",
      description:
        "The teller prints the rejection, and the account handles GetBalance. There is no return value: the account tells a Reply to the replyTo address, and in the next round the teller prints 'balance 75.00'. After that every mailbox is empty, so a round processes nothing and run returns.",
      highlight: [
        "tellerMailbox",
        "receiveTeller",
        "teller",
        "scheduler",
        "nextMessage",
        "accountMailbox",
        "receiveAccount",
        "account",
        "replyToTeller",
      ],
      packets: [
        { relation: "receiveTeller", label: "receive(Reply)" },
        { relation: "nextMessage", label: "next: GetBalance", after: 0 },
        { relation: "receiveAccount", label: "receive(GetBalance)", after: 1 },
        { relation: "replyToTeller", label: "Reply: balance", after: 2 },
        { relation: "receiveTeller", label: "receive(Reply)", after: 3 },
      ],
      notes: {
        teller: "balance 75.00",
        account: "balance 75.00",
        accountMailbox: "empty",
        tellerMailbox: "empty",
      },
      code: "account",
    },
    {
      title: "A bad deposit crashes the account",
      description:
        "main tells the account Deposit 0.00 and then GetBalance, and calls run again. In round 1 the account throws on the zero deposit (in Go it returns an error): the system drops that message, suspends the account and puts a Failed message in the supervisor's mailbox. The GetBalance stays in the account's mailbox, but a suspended actor is skipped.",
      highlight: [
        "client",
        "tell",
        "accountMailbox",
        "scheduler",
        "nextMessage",
        "receiveAccount",
        "account",
        "failed",
        "supervisorMailbox",
      ],
      packets: [
        { relation: "tell", label: "Deposit 0.00" },
        { relation: "tell", label: "GetBalance", after: 0 },
        { relation: "nextMessage", label: "next: Deposit 0.00", after: 1 },
        { relation: "receiveAccount", label: "receive(Deposit)", after: 2 },
        { relation: "failed", label: "Failed(account)", after: 3 },
      ],
      notes: {
        account: "crashed: suspended",
        accountMailbox: "1 waiting",
        supervisorMailbox: "1 queued",
      },
      code: "actorSystem",
    },
    {
      title: "The supervisor restarts the account",
      description:
        "In round 2 the supervisor takes the Failed message, prints 'account crashed (invalid amount 0.00), restarting it' and asks the system to restart the account. The old instance is discarded and a fresh one is built from the factory, so the 75.00 that lived only in memory is gone: the new balance is 0.00. This is 'let it crash' with one-for-one supervision.",
      highlight: ["supervisorMailbox", "receiveSupervisor", "supervisor", "restart", "account"],
      packets: [
        { relation: "receiveSupervisor", label: "receive(Failed)" },
        { relation: "restart", label: "restart(account)", after: 0 },
      ],
      notes: {
        supervisor: "account crashed",
        account: "fresh: balance 0.00",
        supervisorMailbox: "empty",
      },
      code: "supervisor",
    },
    {
      title: "The new account answers the waiting message",
      description:
        "The account comes after the supervisor in spawn order, so in the same round the fresh instance takes the GetBalance that was already waiting and replies. In round 3 the teller prints 'balance 0.00', and main prints 'account restarts: 1'. A persistent actor would instead rebuild its balance by replaying its events (event sourcing).",
      highlight: [
        "scheduler",
        "nextMessage",
        "accountMailbox",
        "receiveAccount",
        "account",
        "replyToTeller",
        "tellerMailbox",
        "receiveTeller",
        "teller",
      ],
      packets: [
        { relation: "nextMessage", label: "next: GetBalance" },
        { relation: "receiveAccount", label: "receive(GetBalance)", after: 0 },
        { relation: "replyToTeller", label: "Reply: balance", after: 1 },
        { relation: "receiveTeller", label: "receive(Reply)", after: 2 },
      ],
      notes: { account: "restarts: 1", teller: "balance 0.00", accountMailbox: "empty" },
      code: "account",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: ActorModelVisualization,
};
