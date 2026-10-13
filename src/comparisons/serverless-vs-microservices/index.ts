/**
 * Serverless and Microservices are answers to different questions, which is why they get mixed
 * up: Microservices is about how a system is *split* into independently deployed parts, while
 * Serverless is first a deployment and operations model, about *who runs* the process and how
 * long it lives. A microservice can be built as a function, and a function can be one part of a
 * larger system. Every claim below was checked against `src/architectures/both/serverless` and
 * `src/architectures/both/microservices` (index.ts and all four language examples), not against
 * the two styles in the abstract. In particular, the Microservices example's PaymentsService
 * keeps no data of its own, so nothing here says that every service owns a store.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "serverless-vs-microservices",
  title: "Serverless vs Microservices",
  order: 7,
  summary:
    "Both break a system into small deployable parts. The deciding question is who runs the process: a platform that starts functions when events arrive, or services you deploy and keep running.",
  subjects: [
    { kind: "architecture", slug: "serverless" },
    { kind: "architecture", slug: "microservices" },
  ],
  problem:
    "An order system has several jobs: accept an order over HTTP, send a receipt once the order exists, and produce a daily report. Each could be a separate small unit instead of one big application, and the team has to decide who runs those units, how long they live, and where their data is kept.",
  constraints: [
    "Who should run the process: a platform that starts it when an event arrives and drops it when it is idle, or your team, with services that stay up?",
    "Does the load arrive in bursts with long idle stretches, or is it steady enough that an always-running service is not wasted?",
    "Can a first request tolerate the delay of creating an instance, or must something already be running and warm?",
    "Can all lasting state live in managed services outside the code, or does a unit need to own and shape its own data?",
    "Should the unit be as small as one handler for one trigger, or a service built around a business capability?",
  ],
  dimensions: [
    {
      label: "What it mainly decides",
      values: {
        serverless:
          "How code is run: a deployment and operations model, with no servers to manage, pay per invocation and scale to zero. The page says it is not a whole new way to structure an application.",
        microservices:
          "How a system is split: independently deployable services, each behind an explicit interface, with no service reaching into another's database.",
      },
    },
    {
      label: "Who runs the process",
      values: {
        serverless:
          "The platform. It creates an instance when an event arrives, keeps it warm for a while and drops it when it is idle. In the example, the Platform class stands in for a provider such as AWS Lambda and does this.",
        microservices:
          "You do. A service is deployed and kept running by your team, and you also run what surrounds it, such as the gateway, the broker, deployment pipelines and monitoring. The example builds each service object once at the top of the usage code and leaves it in place for the whole run.",
      },
    },
    {
      label: "What starts the code",
      values: {
        serverless:
          "A trigger. In the example, createOrder runs on an HTTP request, sendReceipt on a queue message and dailyReport on a schedule firing, and the platform decides when.",
        microservices:
          "A call or a message addressed to a service that is already running. In the example, Orders calls Inventory and Payments and waits for the result, and Shipping receives OrderPlaced because it subscribed to the broker.",
      },
    },
    {
      label: "Cold starts and warm instances",
      values: {
        serverless:
          "Part of the model. An invocation that finds no warm instance has to create one first, and the example counts these: createOrder 2, sendReceipt 1, dailyReport 1. After a reclaim, the next call to createOrder is a cold start again.",
        microservices:
          "None in the example: nothing creates a service per request, so every call reaches a service that is already there.",
      },
    },
    {
      label: "Where state lives",
      values: {
        serverless:
          "Outside the instance, in managed services. The example keeps orders and the id counter in a store and messages in a queue, so the next order is order-3 even after every instance was dropped. Memory inside an instance is lost: createOrder's call counter restarts at 1.",
        microservices:
          "Inside the service boundary, where the service keeps any. In the example, Orders holds its own record of orders and its own id counter, and Inventory holds its own product catalog. Payments keeps no data of its own there, only a call counter and a down flag, so not every service in the example has a store.",
      },
    },
    {
      label: "Granularity",
      values: {
        serverless:
          "One function per trigger: createOrder, sendReceipt and dailyReport each have one handler and one reason to run. The functions are smaller than a service, and in the example they never call each other.",
        microservices:
          "One service per business capability: Orders, Inventory, Payments and Shipping. A service is a deployable unit that owns its model behind its own interface, so it is bigger than one handler.",
      },
    },
    {
      label: "How the parts talk",
      values: {
        serverless:
          "Through shared managed services. createOrder and sendReceipt share only the order store and the order-placed queue, and the platform hands each queue message to sendReceipt.",
        microservices:
          "Through explicit client calls and messages. Orders reaches Inventory through InventoryServiceClient, guards Payments with a CircuitBreaker, and publishes OrderPlaced to the MessageBroker.",
      },
    },
    {
      label: "What goes wrong at the seams",
      values: {
        serverless:
          "The parts are only eventually consistent: when dailyReport ran in the example, order-3's message was still queued, so it counted 3 orders but only 2 receipted. Saving an order and enqueueing its message are two separate writes, with no outbox between them. Behaviour such as time limits and retries is set by the platform, and the example hides it.",
        microservices:
          "A remote call can be slow or fail, so callers plan for it. In the example, Payments goes down and the breaker opens after three failures in a row; the next charge fails fast without Payments being called. Consistency across services, and tracing one action through several of them, has to be designed for.",
      },
    },
    {
      label: "What you pay for",
      values: {
        serverless:
          "Per invocation, with no cost while idle: an idle function scales to zero. Cold starts are the price, and ways to soften them, such as pre-warmed instances, cost money while idle.",
        microservices:
          "For running the services and the machinery around them, and for the effort of operating many small deployables.",
      },
    },
  ],
  options: [
    {
      subject: "serverless",
      changes:
        "The platform owns when code runs. createOrder, sendReceipt and dailyReport are registered with a trigger each, and the platform creates an instance on a cold start, reuses the warm one, drops every idle instance when its reclaim-idle call runs, and hands queue messages to sendReceipt. Because an instance can disappear, the order store and the queue hold everything that must last, and createOrder keeps only a call counter in its own memory as a demonstration of what is lost.",
      chooseWhen: [
        "Work arrives in bursts, at unpredictable times or only occasionally, and an always-on process would mostly sit idle.",
        "The unit of work is naturally one event: a request, a queue message or a scheduled job that does one thing and ends.",
        "You want the platform to handle scaling and capacity, and the state already lives, or can live, in managed services.",
        "A short delay on a cold start is acceptable for the first request after a quiet period.",
      ],
      code: [
        { kind: "architecture", slug: "serverless", region: "platform" },
        { kind: "architecture", slug: "serverless", region: "createOrder" },
        { kind: "architecture", slug: "serverless", region: "services" },
      ],
      steps: [
        { kind: "architecture", slug: "serverless", step: 1 },
        { kind: "architecture", slug: "serverless", step: 6 },
        { kind: "architecture", slug: "serverless", step: 7 },
      ],
    },
    {
      subject: "microservices",
      changes:
        "The system is cut along business capabilities and each service is a separate deployable behind an interface. OrderService keeps its own record of orders and its own ids, prices every line through InventoryServiceClient, charges through a CircuitBreaker around PaymentsService, and publishes OrderPlaced only after a successful payment. The callers of Inventory and Payments have to plan for remote failure, which is why the client and the breaker exist.",
      chooseWhen: [
        "Different parts of the system need to scale, deploy or fail independently, and different teams own them.",
        "A unit needs to keep and shape its own data, and be reachable through an interface other services can depend on.",
        "The work is steady or continuous enough that a running service is not wasted, and a request must not wait for an instance to be created.",
        "The organization can afford the operations that go with many services: pipelines, monitoring and service discovery.",
      ],
      code: [
        { kind: "architecture", slug: "microservices", region: "orders" },
        { kind: "architecture", slug: "microservices", region: "inventory" },
        { kind: "architecture", slug: "microservices", region: "breaker" },
      ],
      steps: [
        { kind: "architecture", slug: "microservices", step: 0 },
        { kind: "architecture", slug: "microservices", step: 5 },
        { kind: "architecture", slug: "microservices", step: 8 },
      ],
    },
  ],
  noPattern: {
    when: "One team, one codebase and a steady load, with no need to deploy, scale or fail the parts independently, and nothing that only runs occasionally.",
    instead:
      "Keep a single deployable application and call between modules in-process; the Modular Monolith page describes keeping the boundaries without the network. A recurring job can be an ordinary scheduled task inside the same application.",
  },
  overlap:
    "These two are not rivals, because they answer different questions: Microservices is about how a system is split into deployable parts, while Serverless is about who runs the process and how long it lives. A service does not have to be a long-running process. A part that only reacts to events, such as Shipping reacting to OrderPlaced, could run as a queue-triggered function. Its state would then have to move into a managed store and a cold start would add delay to a call that is a plain method call in the Microservices example. In the other direction, a set of functions that share one store and queue, as in the Serverless example, is not by itself a set of microservices: those functions do not own private stores, and a microservice is a long-running service that you run.",
  scenario: {
    prompt:
      "After an order is placed, a shop has to send a receipt. The work reads the order, sends the message and marks the order receipted, and it needs nothing from any other service. Orders come in bursts around lunch and promotions, and nothing arrives overnight. Which fits best?",
    choices: [
      {
        id: "serverless-function",
        option: "serverless",
        label: "A queue-triggered function whose state lives in the order store",
        verdict: "best",
        explanation:
          "This is one event-sized job with a burst-and-idle load, which is the case Serverless is for. The platform starts an instance when a message arrives and drops it when idle, and nothing is paid in between. The order store holds the status, as in sendReceipt, so any instance can serve any message.",
      },
      {
        id: "receipt-service",
        option: "microservices",
        label: "A separate long-running Receipts service with its own deployment",
        verdict: "workable",
        explanation:
          "It works, and it fits if the team already runs services and wants Receipts to have its own interface and data. For one small job with idle stretches overnight, though, it brings the deployment, monitoring and service discovery that come with another service, and it is running even when no message arrives.",
      },
      {
        id: "in-app-handler",
        option: "none",
        label: "A handler inside the existing application, with no new unit",
        verdict: "workable",
        explanation:
          "If the application already runs and the volume is small, a background handler in the same process needs no new deployable at all. The cost is that it scales and deploys with the rest of the application, which matters once the lunch bursts are big.",
      },
      {
        id: "function-with-memory",
        label: "A function that keeps the running count of receipts sent in its own memory",
        verdict: "poor",
        explanation:
          "Choosing functions is fine, but this use of them is not: memory inside an instance is lost whenever the platform drops it. In the example, createOrder's call counter goes back to 1 after the reclaim-idle call, while the id counter in the store carries on as order-3. Keep such a count in a managed store.",
      },
    ],
  },
};
