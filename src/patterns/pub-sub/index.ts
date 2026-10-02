import type { PatternDefinition } from '@/types/pattern'
import tsExample from './example.ts?raw'
import csExample from './example.cs?raw'
import { PubSubVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'pub-sub',
  name: 'Pub/Sub (Event Bus)',
  category: 'architectural',
  order: 4,
  summary: 'Decouple publishers from subscribers behind a broker that routes messages by topic.',
  intent:
    'Let senders publish messages to named topics without knowing who — if anyone — is listening, and let listeners subscribe to topics without knowing who publishes to them.',
  problem:
    'CheckoutService needs to trigger a receipt email, an analytics event and an inventory update whenever an order is placed. Calling each of those services directly means CheckoutService has to import all three, know their APIs, and grow a new call every time another part of the system wants to react to an order — and the same tangle repeats for every other kind of event in the app.',
  solution:
    'Introduce a broker — the EventBus — that sits between everyone. Publishers call publish(topic, payload) on the bus and never call a subscriber directly. Subscribers call subscribe(topic, handler) on the same bus and get back an unsubscribe function. The bus is the only thing either side depends on, and it only ever deals in topic names and payloads, never concrete classes.',
  analogy:
    'A radio station: a presenter broadcasts on a frequency without knowing who owns a radio tuned to it, and a listener tunes in without knowing — or caring — which studio is transmitting. Switch the dial (unsubscribe) and the broadcast keeps right on going for everyone else.',
  whenToUse: [
    'Many unrelated parts of the system need to react to the same event, and that list keeps growing.',
    'Publishers and subscribers are built, deployed or owned independently and should not import each other.',
    'You want to add or remove a reaction to an event without touching the code that raises it.',
  ],
  pros: [
    'Publishers and subscribers are decoupled from each other — neither references the other\'s type — though both are still coupled to the topic/payload contract.',
    'New subscribers can be added, or removed, without changing a single publisher.',
    'One topic can fan out to any number of handlers, including zero.',
  ],
  cons: [
    'Harder to trace: reading publish("order.placed", …) alone does not tell you what will run.',
    'Delivery order and timing are implementation-defined, and one slow handler can delay the others unless dispatch is made async.',
    'A typo in a topic name fails silently — nothing was subscribed, nothing happens, no error.',
  ],
  realWorld: [
    'Apache Kafka and other log-based message brokers',
    'RabbitMQ and other AMQP topic exchanges',
    'Redis Pub/Sub (PUBLISH / SUBSCRIBE)',
    'Google Cloud Pub/Sub and AWS SNS',
    'In-browser event buses built on EventTarget/CustomEvent, or Node.js EventEmitter used as a shared bus',
  ],
  related: ['observer', 'mediator', 'command'],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: 'checkoutService',
      label: 'CheckoutService',
      role: 'Publisher',
      kind: 'class',
      x: 110,
      y: 150,
      width: 170,
      description:
        'Publishes an event whenever an order is placed. It only ever talks to the EventBus — it has no idea EmailService, AnalyticsService or InventoryService exist, and it never changes when they do.',
    },
    {
      id: 'userService',
      label: 'UserService',
      role: 'Publisher',
      kind: 'class',
      x: 110,
      y: 330,
      width: 150,
      description:
        'Publishes a different event after a new account is created. Built, owned and could be deployed entirely independently of CheckoutService — the two never reference each other.',
    },
    {
      id: 'eventBus',
      label: 'EventBus',
      role: 'Broker',
      kind: 'class',
      x: 400,
      y: 235,
      width: 170,
      description:
        'The only thing publishers and subscribers both depend on. Keeps a set of handlers per topic and is responsible for subscribe, unsubscribe and fan-out — nothing more.',
    },
    {
      id: 'emailService',
      label: 'EmailService',
      role: 'Subscriber',
      kind: 'class',
      x: 700,
      y: 90,
      width: 170,
      description:
        "Subscribes to both topics so it can send a receipt after an order and a welcome note after a signup. It was never given — and does not need — a reference to CheckoutService or UserService.",
    },
    {
      id: 'analyticsService',
      label: 'AnalyticsService',
      role: 'Subscriber',
      kind: 'class',
      x: 700,
      y: 235,
      width: 180,
      description:
        'Subscribes to every topic it cares about purely to log events for later reporting. Adding or removing it never requires touching a single publisher.',
    },
    {
      id: 'inventoryService',
      label: 'InventoryService',
      role: 'Subscriber',
      kind: 'class',
      x: 700,
      y: 380,
      width: 180,
      description:
        'Subscribes only to order.placed, to reserve stock for the order. Later unsubscribes using the function subscribe() handed it back — without anyone else noticing or caring.',
    },
  ],
  relations: [
    {
      id: 'checkout-publish',
      from: 'checkoutService',
      to: 'eventBus',
      type: 'calls',
      label: 'publish()',
      description: "CheckoutService calls bus.publish('order.placed', payload). It passes a topic name and a payload only — never a reference to a handler.",
      code: 'checkoutPublish',
    },
    {
      id: 'user-publish',
      from: 'userService',
      to: 'eventBus',
      type: 'calls',
      label: 'publish()',
      description: "UserService calls bus.publish('user.signedUp', payload) on the very same bus, using a topic name CheckoutService never needs to know about.",
      code: 'userPublish',
    },
    {
      id: 'email-sub',
      from: 'emailService',
      to: 'eventBus',
      type: 'calls',
      label: 'subscribe()',
      description: 'EmailService registers one handler per topic it cares about, and keeps the unsubscribe function the bus hands back for each.',
      code: 'subscribe',
    },
    {
      id: 'analytics-sub',
      from: 'analyticsService',
      to: 'eventBus',
      type: 'calls',
      label: 'subscribe()',
      description: 'AnalyticsService subscribes to both topics purely to record that they happened — it never talks back to a publisher.',
      code: 'subscribe',
      bend: 10,
    },
    {
      id: 'inventory-sub',
      from: 'inventoryService',
      to: 'eventBus',
      type: 'calls',
      label: 'subscribe()',
      description: "InventoryService subscribes only to order.placed, keeping the unsubscribe function returned by subscribe() so it can stop listening later.",
      code: 'subscribe',
    },
    {
      id: 'notify-email-order',
      from: 'eventBus',
      to: 'emailService',
      type: 'notifies',
      label: 'order.placed',
      description: "When order.placed is published, the bus loops over that topic's handlers and calls EmailService's — sending a receipt.",
      code: 'dispatch',
      bend: 25,
    },
    {
      id: 'notify-analytics-order',
      from: 'eventBus',
      to: 'analyticsService',
      type: 'notifies',
      label: 'order.placed',
      description: "The same publish() call also reaches AnalyticsService's order.placed handler; ordering is implementation-defined (this bus dispatches synchronously, in subscription order).",
      code: 'dispatch',
      bend: 18,
    },
    {
      id: 'notify-inventory-order',
      from: 'eventBus',
      to: 'inventoryService',
      type: 'notifies',
      label: 'order.placed',
      description: "…and InventoryService's handler too, for as long as it stays subscribed to the topic.",
      code: 'dispatch',
      bend: 15,
    },
    {
      id: 'notify-email-user',
      from: 'eventBus',
      to: 'emailService',
      type: 'notifies',
      label: 'user.signedUp',
      description: "When user.signedUp is published, the bus calls EmailService's handler for that topic — a different handler than the one above.",
      code: 'dispatch',
      bend: -25,
    },
    {
      id: 'notify-analytics-user',
      from: 'eventBus',
      to: 'analyticsService',
      type: 'notifies',
      label: 'user.signedUp',
      description: "AnalyticsService's user.signedUp handler fires the same way, logging the event without UserService ever knowing it exists.",
      code: 'dispatch',
      bend: -18,
    },
  ],

  // Animated scenario
  steps: [
    {
      title: 'Services subscribe to their topics',
      description:
        'EmailService, AnalyticsService and InventoryService each call bus.subscribe(topic, handler) on startup. The bus just adds the handler to a set for that topic name — it has no idea which classes these are.',
      highlight: ['eventBus', 'email-sub', 'analytics-sub', 'inventory-sub', 'emailService', 'analyticsService', 'inventoryService'],
      notes: { eventBus: 'topics: 2', emailService: 'listening', analyticsService: 'listening', inventoryService: 'listening' },
      code: 'subscribe',
    },
    {
      title: 'CheckoutService publishes order.placed',
      description: 'After charging the card, CheckoutService calls bus.publish("order.placed", …). It does not know — or care — whether anyone is listening.',
      highlight: ['checkoutService', 'checkout-publish', 'eventBus'],
      packets: [{ relation: 'checkout-publish', label: 'order.placed' }],
      notes: { eventBus: 'order.placed ▶' },
      code: 'checkoutPublish',
    },
    {
      title: 'The bus fans out to order.placed subscribers',
      description:
        'Inside publish(), the bus loops over every handler registered for "order.placed" and calls it. EmailService, AnalyticsService and InventoryService all react.',
      highlight: ['eventBus', 'notify-email-order', 'notify-analytics-order', 'notify-inventory-order', 'emailService', 'analyticsService', 'inventoryService'],
      packets: [
        { relation: 'notify-email-order', label: 'order.placed' },
        { relation: 'notify-analytics-order', label: 'order.placed' },
        { relation: 'notify-inventory-order', label: 'order.placed' },
      ],
      notes: { emailService: 'sending receipt', analyticsService: 'event logged', inventoryService: 'stock reserved' },
      code: 'dispatch',
    },
    {
      title: 'UserService publishes user.signedUp',
      description: 'A completely different part of the system — UserService — publishes to a different topic. It never imported EmailService or AnalyticsService.',
      highlight: ['userService', 'user-publish', 'eventBus'],
      packets: [{ relation: 'user-publish', label: 'user.signedUp' }],
      notes: { eventBus: 'user.signedUp ▶' },
      code: 'userPublish',
    },
    {
      title: 'Only user.signedUp subscribers react',
      description:
        'InventoryService never subscribed to "user.signedUp", so the bus does not call it. EmailService sends a welcome note and AnalyticsService logs the event; InventoryService stays idle.',
      highlight: ['eventBus', 'notify-email-user', 'notify-analytics-user', 'emailService', 'analyticsService'],
      packets: [
        { relation: 'notify-email-user', label: 'user.signedUp' },
        { relation: 'notify-analytics-user', label: 'user.signedUp' },
      ],
      notes: { emailService: 'welcome sent', analyticsService: 'event logged', inventoryService: 'idle' },
      code: 'dispatch',
    },
    {
      title: 'InventoryService unsubscribes',
      description:
        'InventoryService calls the unsubscribe function it got back from subscribe(), removing its handler from the "order.placed" set. The bus and every publisher are completely unaffected — neither ever held a reference to InventoryService directly.',
      highlight: ['inventory-sub', 'inventoryService', 'eventBus'],
      notes: { inventoryService: 'unsubscribed', eventBus: 'order.placed: 2 handlers' },
      code: 'unsubscribe',
    },
    {
      title: 'A later order.placed skips Inventory',
      description:
        'CheckoutService publishes another order exactly the same way as before — it never knows InventoryService unsubscribed. EmailService and AnalyticsService still receive it; InventoryService is simply never called.',
      highlight: ['checkoutService', 'checkout-publish', 'eventBus', 'notify-email-order', 'notify-analytics-order', 'emailService', 'analyticsService'],
      packets: [
        { relation: 'checkout-publish', label: 'order.placed' },
        { relation: 'notify-email-order', label: 'order.placed' },
        { relation: 'notify-analytics-order', label: 'order.placed' },
      ],
      notes: { inventoryService: 'not notified' },
      code: 'dispatch',
    },
    {
      title: 'Publishers and subscribers never meet',
      description:
        'At no point did CheckoutService, UserService, EmailService, AnalyticsService or InventoryService reference one another. The only thing everyone shares is the EventBus, and the string names of its topics.',
      highlight: ['checkoutService', 'userService', 'eventBus', 'emailService', 'analyticsService', 'inventoryService'],
      code: 'eventBus',
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  Visualization: PubSubVisualization,
}
