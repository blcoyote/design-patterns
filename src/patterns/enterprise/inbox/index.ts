import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "inbox",
  name: "Idempotent Consumer (Inbox)",
  category: "enterprise",
  order: 12,
  summary:
    "Record each processed message id in the same transaction as its effect, so a redelivered message is recognised and skipped.",
  intent:
    "Turn at-least-once delivery into effectively-once processing by storing the id of every handled message in an inbox table, in the same local transaction as the business change the message caused. A message whose id is already in the inbox is acknowledged and ignored.",
  problem:
    "A broker that guarantees at-least-once delivery will redeliver a message whenever it never saw an acknowledgement: after a crash, a timeout or a lost ack. ShippingConsumer ships an order for every order.placed it receives, so a second delivery ships the order twice. Remembering ids in memory does not help, because the memory is lost on restart. Saving the id and doing the work as two separate writes does not help either: a crash between them either ships without recording the id or records the id without shipping.",
  solution:
    "Give the consumer an inbox table in the same database as its business data. For each message, ShippingConsumer first checks whether the message id is already in the inbox and, if so, returns without doing anything, so the broker gets its acknowledgement and stops redelivering. Otherwise it inserts the inbox row and the shipment in one transaction, so they commit together or not at all. A failed attempt leaves no trace and is simply retried, and a duplicate of a finished message finds its id in the inbox. The inbox id is a primary key, so if two deliveries race past the check, the second commit fails with a duplicate-key error, rolls back its shipment and is treated as a duplicate.",
  analogy:
    "A mailroom clerk stamps every parcel's tracking number in a logbook at the same moment they hand the parcel to the right desk, with one motion, not two. If the courier turns up again with the same parcel, the clerk sees the number in the logbook and says 'already delivered' instead of passing it on a second time.",
  whenToUse: [
    "The broker delivers at-least-once and handling the same message twice would do harm: double shipments, double charges, duplicate emails.",
    "The consumer already has a database, so the processed id can be stored in the same transaction as the effect.",
    "Messages carry a stable unique id that is the same on every redelivery, for example the producer's outbox row id.",
  ],
  pros: [
    "Duplicates are harmless: processing a message twice has the same result as processing it once.",
    "Survives restarts, because the processed ids live in the database, not in memory.",
    "Atomic with the effect: there is no window where the work is done but not recorded, or recorded but not done.",
    "Pairs naturally with the Transactional Outbox: the outbox gives at-least-once publishing and the inbox makes the receiving end safe.",
  ],
  cons: [
    "Every consumer needs an inbox table and an extra lookup and insert per message.",
    "The inbox grows forever unless old ids are purged, and purging too early re-opens the window for a late duplicate.",
    "Only covers effects inside the consumer's own database. A side effect on another system, such as an email or a payment call, still needs its own idempotency key.",
    "It deduplicates messages, not business meaning: two different messages that ask for the same thing still both run.",
  ],
  realWorld: [
    "MassTransit and NServiceBus inbox / deduplication",
    "Wolverine's durable inbox",
    "Kafka consumers storing the processed offset or message id in the same transaction as their writes",
    "Payment APIs that accept an idempotency key and return the original result on a repeat",
  ],
  related: ["outbox", "pub-sub", "unit-of-work", "repository"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "messageBroker",
      label: "MessageBroker",
      role: "Message broker",
      kind: "class",
      x: 110,
      y: 110,
      width: 170,
      description:
        "Delivers each message at-least-once: until a handler returns and its acknowledgement arrives, it keeps redelivering. A handler failure and a lost ack look the same to it, and both lead to a redelivery.",
    },
    {
      id: "shippingConsumer",
      label: "ShippingConsumer",
      role: "Idempotent consumer",
      kind: "class",
      x: 420,
      y: 110,
      width: 190,
      description:
        "Checks the inbox for the message id, and if it is new, writes the inbox row and the shipment in one transaction. A message it has already handled is ignored but still returns normally, so the broker acknowledges it.",
    },
    {
      id: "database",
      label: "Database",
      role: "Inbox + Shipments tables",
      kind: "object",
      x: 420,
      y: 350,
      width: 190,
      description:
        "One database holding both the shipments table and the inbox table of processed message ids. Having both in the same database is what lets one local transaction cover the effect and its record.",
    },
  ],
  relations: [
    {
      id: "deliver",
      from: "messageBroker",
      to: "shippingConsumer",
      type: "notifies",
      label: "order.placed",
      description:
        "The broker calls the consumer with the message. When the handler returns, the broker waits for the acknowledgement; if none comes, it delivers the same message again.",
      code: "deliver",
    },
    {
      id: "check",
      from: "shippingConsumer",
      to: "database",
      type: "calls",
      label: "seen?",
      description:
        "The consumer asks whether the message id is already in the inbox. A yes means the work was committed earlier, so it does nothing more.",
      code: "inboxCheck",
      bend: 50,
    },
    {
      id: "save",
      from: "shippingConsumer",
      to: "database",
      type: "calls",
      label: "inbox + shipment",
      description:
        "One transaction inserts the inbox row and the shipment row. They commit together or not at all.",
      code: "inboxCommit",
      bend: -50,
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Message 1 arrives",
      description:
        "The broker delivers order.placed with id 1 for order A1 to ShippingConsumer. This is the first attempt.",
      highlight: ["messageBroker", "deliver", "shippingConsumer"],
      packets: [{ relation: "deliver", label: "order A1 #1" }],
      notes: { shippingConsumer: "received #1" },
      code: "deliver",
    },
    {
      title: "Not in the inbox yet",
      description:
        "The consumer looks for id 1 in the inbox and finds nothing, so this is new work.",
      highlight: ["shippingConsumer", "check", "database"],
      packets: [
        { relation: "check", label: "seen #1?" },
        { relation: "check", label: "no", reverse: true, after: 0 },
      ],
      notes: { database: "inbox 0 · shipments 0" },
      code: "inboxCheck",
    },
    {
      title: "The transaction fails",
      description:
        "The connection drops before the commit. Neither the inbox row nor the shipment is stored, because they were one transaction, and the handler fails. The broker gets no acknowledgement.",
      highlight: ["shippingConsumer", "save", "database"],
      packets: [{ relation: "save", label: "inbox #1 + A1 ✗" }],
      notes: { database: "inbox 0 · shipments 0", shippingConsumer: "failed" },
      code: "transaction",
    },
    {
      title: "The broker redelivers",
      description:
        "No acknowledgement, so the broker delivers message 1 again. The inbox is still empty, because the failed attempt left nothing behind, so the consumer treats it as new.",
      highlight: ["messageBroker", "deliver", "shippingConsumer", "check", "database"],
      packets: [
        { relation: "deliver", label: "order A1 #1" },
        { relation: "check", label: "seen #1?", after: 0 },
        { relation: "check", label: "no", reverse: true, after: 1 },
      ],
      notes: { shippingConsumer: "received #1 again" },
      code: "deliver",
    },
    {
      title: "Inbox row and shipment commit together",
      description:
        "This time the transaction commits: inbox row #1 and the shipment for A1 are stored in one step.",
      highlight: ["shippingConsumer", "save", "database"],
      packets: [{ relation: "save", label: "inbox #1 + A1 ✓" }],
      notes: { database: "inbox 1 · shipments 1" },
      code: "inboxCommit",
    },
    {
      title: "The acknowledgement is lost",
      description:
        "The handler returned, but the acknowledgement never reaches the broker. From the broker's side the message may not have been handled, so it must deliver it once more.",
      highlight: ["messageBroker", "deliver", "shippingConsumer"],
      packets: [{ relation: "deliver", label: "ack ✗", reverse: true }],
      notes: { messageBroker: "no ack" },
      code: "deliver",
    },
    {
      title: "The duplicate is recognised",
      description:
        "Message 1 arrives a third time. The consumer finds id 1 in the inbox, so it does nothing and returns normally. The broker finally gets its acknowledgement and stops.",
      highlight: ["messageBroker", "deliver", "shippingConsumer", "check", "database"],
      packets: [
        { relation: "deliver", label: "order A1 #1" },
        { relation: "check", label: "seen #1?", after: 0 },
        { relation: "check", label: "yes", reverse: true, after: 1 },
        { relation: "deliver", label: "ack ✓", reverse: true, after: 2 },
      ],
      notes: {
        shippingConsumer: "duplicate ignored",
        database: "inbox 1 · shipments 1",
        messageBroker: "acked",
      },
      code: "inboxCheck",
    },
    {
      title: "Delivered three times, shipped once",
      description:
        "The broker delivered message 1 three times: a failure, a lost acknowledgement and a duplicate. Order A1 was shipped exactly once, because the inbox row and the shipment were never separated.",
      highlight: ["messageBroker", "shippingConsumer", "database"],
      code: "shippingConsumer",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
