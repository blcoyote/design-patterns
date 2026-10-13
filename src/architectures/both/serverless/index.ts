import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { ServerlessVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "serverless",
  name: "Serverless (Functions as a Service)",
  paradigm: "both",
  order: 17,
  summary:
    "Small stateless functions run by a managed platform when an event arrives (an HTTP request, a queue message, a schedule), scaled from zero on demand, with all lasting state kept in managed services.",
  intent:
    "Serverless is first of all a deployment and operations model: there are no servers to manage, you pay per invocation, and an idle function costs nothing because it scales to zero. Architecturally it pushes you toward a particular shape: small functions that are triggered by events, hold no state that must last, and keep everything durable in managed services such as a database and a queue. It is a way of running code and a set of habits for writing it, not a whole new way to structure an application.",
  problem:
    "Running your own servers means sizing them for the peak, paying for them while they sit idle, and patching and scaling them yourself. A long-lived process also tempts you to keep state in its memory, a counter or a cache that only works while that one process lives on, and that breaks as soon as there are two copies of it or the process is replaced. Work that arrives in bursts, such as a few requests now and a queue backlog later, fits badly in a fixed fleet.",
  solution:
    "Hand the running to a platform. You deploy functions, each with a trigger that says what makes it run, and the platform creates an instance when an event arrives, reuses a warm one when it can, and drops idle ones. A function receives one event plus the managed services and returns; nothing in it may be needed later, so state goes to the store and messages go to a queue. In this example createOrder is triggered by an HTTP request, sendReceipt by a queue message and dailyReport by a schedule, and the three never call each other: the queue and the store are the only things they share. The platform here is a small in-process simulation so the behaviour is visible, with no cloud SDK. Deployment is what is new; the structure is event-driven, stateless components plus managed state.",
  analogy:
    "A taxi company with no drivers on its payroll. When a customer calls, a driver is sent. If one is already waiting at the stand, the trip starts at once; if not, someone must be fetched first, which takes longer. Drivers who sit idle are sent home, and the company pays per trip. A driver's own head is no place for the booking list: it lives in the dispatcher's ledger, so any driver can pick up any trip.",
  whenToUse: [
    "Work arrives in bursts or at unpredictable times, or only occasionally, so a server that is always on would mostly sit idle and you would rather pay per invocation.",
    "The work is naturally event-sized: a request, a queue message or a scheduled job that does one thing and ends.",
    "You want the platform to handle scaling, patching and capacity, and your team has no wish to run servers.",
    "The state already lives in managed services, or can: a hosted database and a managed queue take over what a long-running process would have kept in memory.",
  ],
  pros: [
    "No servers to run and nothing paid while idle. An idle instance is kept warm for a while and then reclaimed; in this example that happens when reclaimIdle runs and drops createOrder's and sendReceipt's warm instances, and the platform creates new ones only when the next event arrives.",
    "Scaling is the platform's job. It creates an instance when events arrive and removes it when they stop; real platforms also run many instances of one function side by side, which this single-instance simulation does not show.",
    "Each function is small and has one trigger. createOrder only answers POST /orders, sendReceipt only handles an order-placed message and dailyReport only runs on its schedule, so each can be read, deployed and changed on its own.",
    "Because functions keep no state that matters, any instance can serve any event. After the reclaim, a fresh createOrder instance still gives the next order the id order-3, because the counter lives in the store.",
  ],
  cons: [
    "Cold starts. An invocation that finds no warm instance has to create one first, which costs time. The example counts them: createOrder 2, sendReceipt 1, dailyReport 1. Real platforms offer ways to soften this, such as provisioned concurrency or pre-warmed instances, which cost money while idle.",
    "Instance memory cannot be trusted. createOrder keeps an in-memory call counter and it restarts from 1 after the reclaim: anything that only lives in memory is gone as soon as the platform decides.",
    "Functions are only eventually consistent with each other. When dailyReport runs, order-3's message is still in the queue, so the report counts 3 orders but only 2 receipted.",
    "Two writes are not one. createOrder saves the order and then enqueues the message; if the instance died in between, the order would exist and nobody would be told. This example has no outbox and no transactional output to close that gap.",
    "The platform sets the rules: execution time limits, event formats, and how failures are retried differ between providers, and moving to another provider means rewriting the parts that touch them. This example hides all of that behind a simulation.",
    "The structure is distributed even if each function is tiny. Following one business action means following events across functions, queues and tables, so debugging needs tracing.",
  ],
  realWorld: [
    "AWS Lambda runs a function when an event source delivers an event: Amazon API Gateway for HTTP requests, SQS for queue messages, and EventBridge schedules for timed runs. Lambda creates execution environments on demand, which is where cold starts come from, and offers provisioned concurrency to keep some prepared.",
    "Azure Functions has the same idea with triggers and bindings (HTTP, Service Bus or Storage queues, timers). Its Premium plan keeps pre-warmed instances so that a first request does not have to wait for a cold start.",
    "Google Cloud Functions is triggered by HTTP requests or by events such as a Pub/Sub message, and runs one function per event on infrastructure that Google manages.",
    "The state in all three lives elsewhere, in managed stores and queues such as DynamoDB, Cosmos DB or Firestore for tables and SQS, Service Bus or Pub/Sub for messages, the services this example imitates with an in-memory store and queue.",
  ],
  concepts: [
    {
      term: "Function",
      description:
        "The unit you deploy: a name, a trigger and a way to create an instance (FunctionDefinition). The instance exposes one handle method that receives a trigger event and the managed services. Here there are three: createOrder, sendReceipt and dailyReport.",
    },
    {
      term: "Trigger / event",
      description:
        "What makes the platform run a function. Events are a closed set, one kind per trigger: an HTTP request, a queue message, or a schedule firing, modelled as a union type in TypeScript and Python, a closed set of records in C# and an interface with a type switch in Go. A function that gets the wrong kind is a bug in the deployment: an exception in TypeScript, C# and Python, a returned error in Go.",
    },
    {
      term: "Platform (managed runtime)",
      description:
        "Owns the instances and the triggers: it routes a request to the function with that route, drains queues in registration order, fires schedules and scales idle instances to zero. Real platforms (AWS Lambda, Azure Functions, Google Cloud Functions) decide all of this themselves; the Platform class only makes it visible, one instance per function and no clock.",
    },
    {
      term: "Cold start and warm instance",
      description:
        "An invocation with no warm instance creates one first (a cold start, counted and printed); later invocations reuse it (warm). The instance stays warm until the platform reclaims it. Reusing prepared instances is the same idea as an object pool.",
    },
    {
      term: "Scale to zero",
      description:
        "When functions sit idle the platform drops their instances and nothing runs, which is why nothing is paid. reclaimIdle stands for idle time passing: it drops every warm instance and prints how many (2 here).",
    },
    {
      term: "Managed services",
      description:
        "The store and the queue: they outlive every instance and are handed to each invocation. The order table also holds the id counter, so ids stay unique however many instances come and go. Real systems use a hosted database and a message service.",
    },
    {
      term: "Statelessness",
      description:
        "A function may keep nothing in memory that it needs later. The example shows what happens otherwise: createOrder's in-memory call counter is a demonstration of instance memory, and it starts again at 1 after a cold start. Only createOrder has such a counter; sendReceipt and dailyReport keep nothing.",
    },
  ],
  variants: [
    {
      name: "Backend as a Service",
      description:
        "Using managed services such as hosted databases, authentication or storage directly from the client instead of writing your own functions. It is also called serverless, and it is a different thing from running your code on a function platform.",
    },
    {
      name: "Containers on demand",
      description:
        "Some platforms scale ordinary containers to zero and run them on demand instead of running a function in a fixed shape. The operations model is the same: no servers to manage, pay for use, scale to zero. This example only has functions.",
    },
    {
      name: "Workflow orchestration",
      description:
        "Longer processes that span several functions are often coordinated by a managed workflow service instead of by hand-off through queues. This example uses a queue between two functions and has no orchestrator.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "object-pool",
        why: "The platform keeps a prepared instance for reuse instead of building one per request: the first invoke of createOrder is a cold start, the next two find the warm instance, and reclaimIdle drops them again. Platform keeps at most one warm instance per function and counts the cold starts; a textbook pool holds many and hands them out and takes them back, and here one instance is simply kept and dropped when idle.",
      },
      {
        slug: "outbox",
        why: "This is where an outbox would go, and it is not implemented. createOrder saves the order and then enqueues the message as two separate writes, so an instance that died between them would leave an order that nobody is told about. An outbox would write the message together with the order in the same transaction and have a relay publish it afterwards; in a real deployment the platform's transactional outputs can close the gap. This example does neither.",
      },
    ],
    architectures: [
      {
        slug: "event-driven",
        why: "Every function here is started by an event, and the platform plays the broker's part: createOrder enqueues an order-placed message in MessageQueues and Platform.drainQueues hands it to sendReceipt, so the two never call each other and createOrder knows only the queue name. The routing differs from EventBroker. A message here is taken by one function and removed, where EventBroker fans an OrderPlaced out by topic to every subscriber. Only sendReceipt is queue-triggered; createOrder is triggered by an HTTP request and dailyReport by a schedule, which are not broker events.",
      },
      {
        slug: "microservices",
        why: "Both split a system into small units deployed on their own that cooperate through messages. createOrder and sendReceipt share only the OrderStore and the order-placed queue, much as OrderService and ShippingService share an OrderPlaced event. The unit differs. The microservices in that example are long-running services that you run, and Orders and Inventory each keep a private store; these functions are started and dropped by the platform and all use one OrderStore. They also never call each other, where OrderService calls Inventory and Payments and needs InventoryServiceClient and a circuit breaker.",
      },
      {
        slug: "pipes-and-filters",
        why: "createOrder and sendReceipt are a two-stage pipeline: the first writes and enqueues, the order-placed queue is the pipe, and the second reads on its own invocation, each knowing only the queue name. It is not the stream of the Pipes and Filters page. There a lazy pipe() hands each record through all the stages inside one process, while here the pipe is a managed queue between separately triggered functions. Only an orderId travels in the message; sendReceipt reads the rest from OrderStore, and both stages write to it, which a pure filter such as addTax does not.",
      },
      {
        slug: "space-based",
        why: "Both start more copies of the same code when load grows, but they keep state in opposite places. A function instance here relies on nothing in its own memory: OrderStore and MessageQueues stand for managed services, and reclaimIdle drops every warm instance. On the Space-Based page the state is in the units: a ProcessingUnit's memory is the working copy, DataGrid.replicate keeps the copies alike and DeploymentManager.start gives a new unit a copy from a peer. A unit has to stay running to hold the data, so it is not scaled to zero, and a change waiting in DataPump exists only in memory until DataWriter.drain applies it.",
      },
    ],
  },

  viewBox: "0 0 1120 740",
  participants: [
    {
      id: "client",
      label: "HTTP client",
      role: "Client",
      kind: "client",
      x: 190,
      y: 385,
      width: 150,
      description:
        "The usage code. It builds the services and the platform, registers the three functions in order, and posts three orders (cust-42 69.97, cust-7 29.99 and cust-9 0.00), reclaims idle instances, posts a fourth and fires the schedule. It sees only the platform: the response, never an instance.",
      code: "usage",
    },
    {
      id: "platform",
      label: "FaaS platform",
      role: "Managed runtime",
      kind: "class",
      x: 190,
      y: 140,
      width: 190,
      description:
        "The runtime that a provider such as AWS Lambda runs for you, reduced to what can be shown. It routes POST /orders to the function with that route, creates an instance on a cold start and reuses it while warm, drains the order-placed queue in registration order, fires schedules, and scales every instance to zero in reclaimIdle. It keeps at most one warm instance per function and counts cold starts. Real platforms run many instances side by side.",
      patterns: ["object-pool"],
      code: "platform",
    },
    {
      id: "scheduler",
      label: "Schedule trigger",
      role: "Trigger",
      kind: "object",
      x: 190,
      y: 630,
      width: 170,
      description:
        "Stands for a timer that a platform such as an EventBridge schedule provides. There is no clock in the example: tick(daily-report) is the call that makes the schedule fire.",
      code: "platform",
    },
    {
      id: "createOrder",
      label: "createOrder",
      role: "Function (HTTP trigger)",
      kind: "class",
      x: 520,
      y: 140,
      width: 270,
      description:
        "Triggered by POST /orders. A call counter in its own memory goes up first, and it is the only function with instance memory. An order of 0 or less is answered with 400 and nothing is stored or enqueued. Otherwise the id comes from the store's counter, the order is saved with status received, a message is enqueued and the answer is 201. Saving and then enqueueing are two separate writes, with no outbox between them.",
      patterns: ["outbox"],
      code: "createOrder",
    },
    {
      id: "sendReceipt",
      label: "sendReceipt",
      role: "Function (queue trigger)",
      kind: "class",
      x: 520,
      y: 430,
      width: 270,
      description:
        "Triggered by a message on the order-placed queue, once per message. It reads the order from the store, prints the receipt and saves the order again with status receipted. It keeps nothing in memory; a message for an unknown order would be an error (an exception in TypeScript, C# and Python, a returned error in Go), which this example never triggers.",
      code: "sendReceipt",
    },
    {
      id: "dailyReport",
      label: "dailyReport",
      role: "Function (schedule trigger)",
      kind: "class",
      x: 520,
      y: 630,
      width: 270,
      description:
        "Triggered by the daily-report schedule. It only reads: it takes every order from the store and prints how many there are, their total and how many are receipted. It sees whatever the other functions have stored by then, including an order whose receipt is still waiting in the queue.",
      code: "dailyReport",
    },
    {
      id: "queue",
      label: "order-placed queue",
      role: "Managed queue",
      kind: "object",
      x: 800,
      y: 285,
      width: 150,
      description:
        "A named queue standing in for SQS, Service Bus or Pub/Sub. This one is first in first out; real services guarantee order only when configured for it (SQS FIFO queues, Service Bus sessions, Pub/Sub ordering keys). A message waits here until the platform takes it and hands it to sendReceipt. It lives outside every function instance, so a reclaim does not touch it.",
      code: "services",
    },
    {
      id: "store",
      label: "Orders table",
      role: "Managed store",
      kind: "object",
      x: 1000,
      y: 430,
      width: 150,
      description:
        "The table that holds every order and, with it, the id counter. It outlives every instance, which is why order-3 gets its id after the reclaim although createOrder's own counter went back to 1. Real systems use a hosted database such as DynamoDB, Cosmos DB or Firestore; here it is an in-memory object.",
      code: "services",
    },
  ],
  relations: [
    {
      id: "post",
      from: "client",
      to: "platform",
      type: "calls",
      label: "POST /orders",
      description:
        "A request from outside. The platform routes it by the key 'POST /orders' to the one function with that http trigger and returns that function's answer to the caller; the caller never sees an instance.",
      code: "usage",
    },
    {
      id: "invoke",
      from: "platform",
      to: "createOrder",
      type: "calls",
      label: "invoke",
      description:
        "The platform finds a warm createOrder instance and prints warm, or creates one and prints cold start, and then calls its handle with the event and the services.",
      code: "platform",
    },
    {
      id: "save",
      from: "createOrder",
      to: "store",
      type: "calls",
      label: "save",
      bend: -110,
      description:
        "createOrder takes the next id from the store's counter and saves the order with status received. This is the first of two separate writes.",
      code: "createOrder",
    },
    {
      id: "enqueue",
      from: "createOrder",
      to: "queue",
      type: "calls",
      label: "enqueue",
      description:
        "The second write: a message with the order id goes onto the order-placed queue. Nothing makes it succeed together with the save, which is the gap an outbox would close.",
      code: "createOrder",
    },
    {
      id: "trigger",
      from: "queue",
      to: "sendReceipt",
      type: "calls",
      label: "trigger",
      description:
        "While draining, the platform takes the oldest message from the queue and invokes sendReceipt with it, one invocation per message, until the queue is empty. Nothing calls sendReceipt directly.",
      code: "platform",
    },
    {
      id: "markReceipted",
      from: "sendReceipt",
      to: "store",
      type: "calls",
      label: "read / mark receipted",
      description:
        "sendReceipt reads the order by id, prints the receipt and saves the order again with status receipted. The status lives in the store, not in the instance.",
      code: "sendReceipt",
    },
    {
      id: "fire",
      from: "scheduler",
      to: "dailyReport",
      type: "calls",
      label: "trigger",
      description:
        "A schedule firing makes the platform invoke dailyReport. In this example tick(daily-report) is that firing; a real platform has a timer.",
      code: "platform",
    },
    {
      id: "readAll",
      from: "dailyReport",
      to: "store",
      type: "calls",
      label: "read all",
      description: "dailyReport reads every order, oldest first, and counts them. It never writes.",
      code: "dailyReport",
    },
  ],

  steps: [
    {
      title: "The platform runs short-lived function instances",
      description:
        "The platform and the triggers sit outside the application: the platform owns the instances and decides when a function runs. Function instances are short-lived: one may stay warm between calls (createOrder even counts its calls in memory), but nothing durable may live there. The state that must last lives in managed services, the orders table and the queue, which outlive every instance. Nothing here is a server you run.",
      highlight: ["platform", "createOrder", "sendReceipt", "dailyReport", "store", "queue"],
      notes: { platform: "owns instances and triggers", store: "state lives here" },
      code: "events",
    },
    {
      title: "First request: cold start",
      description:
        "main posts cust-42 69.97. No createOrder instance exists, so the platform prints 'createOrder: cold start' and creates one. The handler takes the id order-1 from the store's counter, saves the order, enqueues a message for it, and the platform returns 201 'order-1 received (instance call 1)'. The save and the enqueue are two separate writes.",
      highlight: [
        "client",
        "post",
        "platform",
        "invoke",
        "createOrder",
        "save",
        "store",
        "enqueue",
        "queue",
      ],
      packets: [
        { relation: "post", label: "POST /orders" },
        { relation: "invoke", label: "invoke (cold start)", after: 0 },
        { relation: "save", label: "save order-1", after: 1 },
        { relation: "enqueue", label: "enqueue order-1", after: 2 },
        { relation: "post", label: "201 order-1", reverse: true, after: 3 },
      ],
      notes: {
        createOrder: "instance call 1",
        platform: "createOrder cold starts: 1",
        store: "order-1",
        queue: "1 queued",
      },
      code: "createOrder",
    },
    {
      title: "Second request: warm instance",
      description:
        "cust-7 29.99 finds the createOrder instance from before, so the platform prints 'createOrder: warm' and no cold start is counted. The instance's own counter has gone up to 2, and the store's counter gives order-2. Order-2 is saved and enqueued behind order-1.",
      highlight: [
        "client",
        "post",
        "platform",
        "invoke",
        "createOrder",
        "save",
        "store",
        "enqueue",
        "queue",
      ],
      packets: [
        { relation: "post", label: "POST /orders" },
        { relation: "invoke", label: "invoke (warm)", after: 0 },
        { relation: "save", label: "save order-2", after: 1 },
        { relation: "enqueue", label: "enqueue order-2", after: 2 },
        { relation: "post", label: "201 order-2", reverse: true, after: 3 },
      ],
      notes: {
        createOrder: "instance call 2",
        platform: "createOrder cold starts: 1",
        store: "order-1, order-2",
        queue: "2 queued",
      },
      code: "createOrder",
    },
    {
      title: "An invalid request is answered, nothing is stored",
      description:
        "cust-9 0.00 reaches the same warm instance, which counts it as call 3 and sees a total of 0 or less. It answers 400 'total must be positive (instance call 3)' and returns before it touches the store or the queue, so the table still holds 2 orders and the queue holds 2 messages.",
      highlight: ["client", "post", "platform", "invoke", "createOrder"],
      packets: [
        { relation: "post", label: "POST /orders" },
        { relation: "invoke", label: "invoke (warm)", after: 0 },
        { relation: "post", label: "400 total must be positive", reverse: true, after: 1 },
      ],
      notes: {
        createOrder: "instance call 3",
        store: "2 orders, unchanged",
        queue: "2 queued, unchanged",
      },
      code: "createOrder",
    },
    {
      title: "drainQueues: sendReceipt cold-starts for order-1",
      description:
        "Nothing has run sendReceipt yet, because nothing calls it: the platform does when it drains the queue. It takes order-1 from the front, finds no sendReceipt instance and prints 'sendReceipt: cold start'. The function reads the order from the store, prints the receipt to cust-42 for 69.97 and saves it again as receipted.",
      highlight: ["platform", "queue", "trigger", "sendReceipt", "markReceipted", "store"],
      packets: [
        { relation: "trigger", label: "take order-1 (cold start)" },
        { relation: "markReceipted", label: "read order-1", after: 0 },
        { relation: "markReceipted", label: "save: receipted", after: 1 },
      ],
      notes: {
        sendReceipt: "receipt: order-1, 69.97",
        platform: "sendReceipt cold starts: 1",
        store: "order-1 receipted",
        queue: "1 queued",
      },
      code: "sendReceipt",
    },
    {
      title: "drainQueues: sendReceipt is warm for order-2",
      description:
        "The queue is not empty, so the platform takes order-2 and invokes sendReceipt again. This time the instance is warm and the platform prints 'sendReceipt: warm'. The receipt goes to cust-7 for 29.99, order-2 is marked receipted, and the queue is empty.",
      highlight: ["platform", "queue", "trigger", "sendReceipt", "markReceipted", "store"],
      packets: [
        { relation: "trigger", label: "take order-2 (warm)" },
        { relation: "markReceipted", label: "read order-2", after: 0 },
        { relation: "markReceipted", label: "save: receipted", after: 1 },
      ],
      notes: {
        sendReceipt: "receipt: order-2, 29.99",
        platform: "sendReceipt cold starts: 1",
        store: "orders 1 and 2 receipted",
        queue: "empty",
      },
      code: "sendReceipt",
    },
    {
      title: "reclaimIdle: scale to zero",
      description:
        "Idle time passes. The platform drops every warm instance and prints 'idle instances reclaimed: 2': createOrder's and sendReceipt's. dailyReport never ran, so it has none to lose. Whatever lived only in an instance is gone, including createOrder's call counter at 3. The orders are still in the table and the queue is untouched, because they live in the managed services.",
      highlight: ["platform", "createOrder", "sendReceipt", "store"],
      notes: {
        platform: "reclaimed: 2",
        createOrder: "reclaimed, call counter lost",
        sendReceipt: "reclaimed",
        dailyReport: "no instance yet",
        store: "2 orders kept",
      },
      code: "platform",
    },
    {
      title: "Cold start again, but the id is order-3",
      description:
        "cust-42 15.00 finds no createOrder instance: 'createOrder: cold start', a new instance whose counter starts at 1, so the answer reads 'instance call 1'. The id is order-3 all the same, because the counter is in the store, not in the instance. The new order is saved and enqueued, and this message is not drained before the report.",
      highlight: [
        "client",
        "post",
        "platform",
        "invoke",
        "createOrder",
        "save",
        "store",
        "enqueue",
        "queue",
      ],
      packets: [
        { relation: "post", label: "POST /orders" },
        { relation: "invoke", label: "invoke (cold start)", after: 0 },
        { relation: "save", label: "save order-3", after: 1 },
        { relation: "enqueue", label: "enqueue order-3", after: 2 },
        { relation: "post", label: "201 order-3", reverse: true, after: 3 },
      ],
      notes: {
        createOrder: "instance call 1",
        platform: "createOrder cold starts: 2",
        store: "3 orders",
        queue: "1 queued (order-3)",
      },
      code: "createOrder",
    },
    {
      title: "The schedule fires: the report is eventually consistent",
      description:
        "tick(daily-report) makes the platform invoke dailyReport. It has no instance, so 'dailyReport: cold start'. It reads all three orders and prints '3 orders, total 114.96, 2 receipted': order-3's message is still waiting in the queue, so the report counts it but it is not receipted yet. The cold starts end at createOrder 2, sendReceipt 1, dailyReport 1.",
      highlight: ["scheduler", "fire", "platform", "dailyReport", "readAll", "store", "queue"],
      packets: [
        { relation: "fire", label: "tick (cold start)" },
        { relation: "readAll", label: "read all", after: 0 },
        { relation: "readAll", label: "3 orders", reverse: true, after: 1 },
      ],
      notes: {
        dailyReport: "3 orders, 114.96, 2 receipted",
        queue: "1 still queued",
        platform: "cold starts: 2, 1, 1",
      },
      code: "dailyReport",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: ServerlessVisualization,
};
