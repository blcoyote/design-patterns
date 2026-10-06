import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "outbox",
  name: "Transactional Outbox",
  category: "enterprise",
  order: 10,
  summary:
    "Save the event in the same transaction as the data, then let a separate relay publish it to the broker.",
  intent:
    "Make 'update the database' and 'record that a message must be published' succeed or fail together, without a distributed transaction, by writing the message to an outbox table in the same local transaction as the business data. A relay publishes it from there afterwards, retrying until the broker accepts it.",
  problem:
    "OrderService must save an order and tell ShippingConsumer about it. Writing the row and then calling the broker are two separate systems, so there is no transaction around both. If the process crashes between them, the order exists but nobody is ever told. Publish first and save second, and a failed save leaves a message about an order that does not exist.",
  solution:
    "Keep both writes in the one system that can be atomic: the database. OrderService inserts the order row and an outbox row describing the OrderPlaced event inside a single transaction, and never talks to the broker. A separate OutboxRelay polls the outbox table for rows that are not yet published, publishes each one to the MessageBroker, and then marks it published. If the relay fails between publishing and marking, the row is still pending and is published again, so delivery is at-least-once and consumers must ignore duplicates, for example by remembering message ids.",
  analogy:
    "You write a letter and drop it in the outgoing tray at the same moment you file your copy of the order. A courier empties the tray on a schedule. If the courier is interrupted before ticking the letter off, they simply carry it again next round, so the recipient might get two copies but never none.",
  whenToUse: [
    "A service must change its own database and publish an event about that change, and losing either half is unacceptable.",
    "A distributed transaction (two-phase commit) across the database and the broker is unavailable or too costly.",
    "Downstream services can tolerate a short delay and can handle the same message twice.",
  ],
  pros: [
    "The state change and the event are atomic: either both are stored or neither is.",
    "A broker outage never fails the business operation; messages simply wait in the outbox until the broker is back.",
    "No distributed transaction is needed, only a local one on a database you already have.",
  ],
  cons: [
    "Delivery is at-least-once, so every consumer has to be idempotent, for example by deduplicating on the message id.",
    "Events are published later than they are saved: there is extra latency and one more component, the relay, to run and monitor.",
    "The outbox table grows and needs cleaning up, and the relay's polling adds load to the database (log-tailing change data capture avoids polling at the cost of extra infrastructure).",
    "Publishing in order needs care: the relay in this example stops at the first failure so later messages never overtake an earlier one, but several relay instances would need extra coordination.",
  ],
  realWorld: [
    "Debezium's outbox event router, which tails the outbox table through change data capture",
    "MassTransit and NServiceBus transactional outbox",
    "Axon, Wolverine and Spring Modulith's event publication registry",
    "Order, payment and inventory services in microservice systems that must emit events reliably",
  ],
  related: ["pub-sub", "unit-of-work", "repository", "command"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "orderService",
      label: "OrderService",
      role: "Producer",
      kind: "class",
      x: 110,
      y: 110,
      width: 170,
      description:
        "Handles placeOrder. It writes the order and the event to the database inside one transaction and has no reference to the broker, so a broker outage cannot make it fail or lose an event.",
    },
    {
      id: "database",
      label: "Database",
      role: "Orders + Outbox tables",
      kind: "object",
      x: 400,
      y: 110,
      width: 190,
      description:
        "One database holding both the business table and the outbox table. That is what makes the pattern work: a single local transaction covers both writes. Each outbox row has a counter id and a published flag.",
    },
    {
      id: "outboxRelay",
      label: "OutboxRelay",
      role: "Relay",
      kind: "class",
      x: 400,
      y: 350,
      width: 170,
      description:
        "A separate process or loop that polls the outbox for rows that are not yet published, publishes each to the broker, then marks it published. If it fails between those two calls, the row is still pending and is published again on the next poll.",
    },
    {
      id: "messageBroker",
      label: "MessageBroker",
      role: "Message broker",
      kind: "class",
      x: 700,
      y: 350,
      width: 170,
      description:
        "Routes each published message to the handlers subscribed to its topic. It is the external system you cannot include in the database transaction.",
    },
    {
      id: "shippingConsumer",
      label: "ShippingConsumer",
      role: "Idempotent consumer",
      kind: "class",
      x: 700,
      y: 110,
      width: 180,
      description:
        "Ships the order when order.placed arrives. Because the relay delivers at-least-once, it remembers the ids of messages it has handled and ignores repeats.",
    },
  ],
  relations: [
    {
      id: "save",
      from: "orderService",
      to: "database",
      type: "calls",
      label: "order + event",
      description:
        "One transaction inserts the order row and the outbox row for the OrderPlaced event. They commit together or not at all.",
      code: "placeOrder",
    },
    {
      id: "poll",
      from: "outboxRelay",
      to: "database",
      type: "calls",
      label: "pending?",
      description:
        "The relay asks the database for outbox rows that are not yet published, oldest first, and gets back a snapshot list.",
      code: "relayPoll",
      bend: 50,
    },
    {
      id: "mark",
      from: "outboxRelay",
      to: "database",
      type: "calls",
      label: "mark published",
      description:
        "After a successful publish the relay marks the row published so later polls skip it. If this call fails, the row stays pending and will be published again.",
      code: "relayMark",
      bend: -50,
    },
    {
      id: "publish",
      from: "outboxRelay",
      to: "messageBroker",
      type: "calls",
      label: "publish()",
      description:
        "The relay hands the message to the broker. This is the only place in the system that talks to the broker.",
      code: "relayPublish",
    },
    {
      id: "deliver",
      from: "messageBroker",
      to: "shippingConsumer",
      type: "notifies",
      label: "order.placed",
      description:
        "The broker calls every handler subscribed to the message's topic, here ShippingConsumer's.",
      code: "deliver",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Order and event are saved together",
      description:
        "OrderService runs one transaction that inserts the order A1 row and an outbox row for the order.placed event. There is no broker call at all, so there is nothing that can half-succeed.",
      highlight: ["orderService", "save", "database"],
      packets: [{ relation: "save", label: "order A1 + event" }],
      notes: { database: "#1 pending" },
      code: "placeOrder",
    },
    {
      title: "The event is safe but not yet sent",
      description:
        "The order is committed and the broker has heard nothing. Even if OrderService crashed right now, outbox row #1 is stored with the order and will be published later. Nothing is lost.",
      highlight: ["database", "messageBroker"],
      notes: { database: "1 pending", messageBroker: "silent" },
      code: "transaction",
    },
    {
      title: "The relay polls the outbox",
      description:
        "OutboxRelay asks the database for rows that are not yet published. It gets back row #1.",
      highlight: ["outboxRelay", "poll", "database"],
      packets: [
        { relation: "poll", label: "pending?" },
        { relation: "poll", label: "#1", reverse: true, after: 0 },
      ],
      notes: { outboxRelay: "1 pending" },
      code: "relayPoll",
    },
    {
      title: "The relay publishes #1",
      description:
        "The relay publishes the message to the broker, which delivers it to ShippingConsumer. The consumer has not seen id 1 before, so it ships order A1.",
      highlight: ["outboxRelay", "publish", "messageBroker", "deliver", "shippingConsumer"],
      packets: [
        { relation: "publish", label: "#1" },
        { relation: "deliver", label: "#1", after: 0 },
      ],
      notes: { shippingConsumer: "shipped A1 (#1)" },
      code: "relayPublish",
    },
    {
      title: "Marking #1 fails",
      description:
        "The relay loses its database connection before it can mark row #1 published. It logs the failure and stops, and row #1 stays pending. The message was delivered but the outbox does not know that yet.",
      highlight: ["outboxRelay", "mark", "database"],
      packets: [{ relation: "mark", label: "mark #1 ✗" }],
      notes: { database: "#1 pending", outboxRelay: "mark failed" },
      code: "relayMark",
    },
    {
      title: "The next poll publishes #1 again",
      description:
        "Row #1 is still pending, so the next poll finds it and publishes it a second time. ShippingConsumer already handled id 1 and ignores the duplicate. At-least-once delivery plus an idempotent consumer gives the right result.",
      highlight: [
        "outboxRelay",
        "poll",
        "publish",
        "deliver",
        "database",
        "messageBroker",
        "shippingConsumer",
      ],
      packets: [
        { relation: "poll", label: "pending?" },
        { relation: "poll", label: "#1", reverse: true, after: 0 },
        { relation: "publish", label: "#1 again", after: 1 },
        { relation: "deliver", label: "#1 again", after: 2 },
      ],
      notes: { shippingConsumer: "duplicate #1 ignored" },
      code: "dedupe",
    },
    {
      title: "Marking #1 succeeds",
      description:
        "This time the mark call works, so row #1 is flagged published. The next poll will find nothing pending and the relay reports that.",
      highlight: ["outboxRelay", "mark", "database"],
      packets: [{ relation: "mark", label: "mark #1 ✓" }],
      notes: { database: "0 pending", outboxRelay: "#1 marked published" },
      code: "relayMark",
    },
    {
      title: "Never lost, possibly twice",
      description:
        "The order and its event were saved atomically, and the relay kept publishing until it could record success. The event reached the consumer, and the one duplicate was discarded by the consumer. No distributed transaction was needed.",
      highlight: ["orderService", "database", "outboxRelay", "messageBroker", "shippingConsumer"],
      code: "outboxRelay",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
