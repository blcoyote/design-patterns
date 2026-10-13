/**
 * Space-Based and Serverless both add capacity by starting more copies of the same code, which
 * is why they get lumped together. They differ in where the state lives: Space-Based keeps the
 * working data in the memory of the running units, Serverless keeps it in managed services and
 * treats every function instance as disposable. Every claim below was checked against
 * `src/architectures/both/space-based` and `src/architectures/both/serverless` (index.ts and
 * all four language examples), not against the styles in the abstract. Both examples are
 * in-process simulations, so nothing here claims a measured latency or a product's behavior.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "space-based-vs-serverless",
  title: "Space-Based vs Serverless",
  order: 8,
  summary:
    "Both add capacity on demand. Space-Based keeps the working data in replicated memory and writes to the database later; Serverless keeps state in managed services and treats its function instances as disposable.",
  subjects: [
    { kind: "architecture", slug: "space-based" },
    { kind: "architecture", slug: "serverless" },
  ],
  problem:
    "A ticket sale or a flash promotion sends a short burst of requests at a system that is quiet the rest of the time. More copies of the application have to start quickly, and every copy has to agree on what is left to sell. Where the data lives while those copies come and go is the decision.",
  constraints: [
    "Is the database the bottleneck during the burst, or does it cope and the problem is only starting enough application instances?",
    "Does the working data fit in memory in every copy of the application, or in a partition of it?",
    "Must every read see the latest committed write, or can the database be behind for a while and units briefly disagree?",
    "Does the load drop to zero for long stretches, so that paying only per invocation matters, or is there a steady base load that keeps units busy anyway?",
    "Can the team build, run and test a data grid, or does it want the platform to run the servers?",
  ],
  dimensions: [
    {
      label: "Where the working state lives",
      values: {
        "space-based":
          "In each ProcessingUnit's own in-memory replica. A purchase reads and changes that replica and never touches the database; the DataGrid copies the change to the other units.",
        serverless:
          "Outside every function instance, in managed services: OrderStore and MessageQueues. The createOrder function keeps an in-memory call counter, and it restarts from 1 after the platform reclaims the instance. The order ids come from the store, so they keep counting (order-3 follows order-2).",
      },
    },
    {
      label: "What a new instance needs before it can serve",
      values: {
        "space-based":
          "A copy of the data. The first unit is loaded from the database by the data reader; a later unit, such as pu-3 in the spike, copies from a peer through the grid (here with seats left 1, newer than the database's 3) and only then joins.",
        serverless:
          "Nothing but its code. The platform creates the instance when an event arrives (a cold start, counted and printed) and hands it the managed services; the data is already there.",
      },
    },
    {
      label: "Peak-load latency",
      values: {
        "space-based":
          "A request is answered from a unit's memory, with no database call: all four buyers are answered this way, and a sold-out answer is rejected from memory too. The cost comes earlier: a new unit has to copy the data before it can take requests, and a unit that is already running does not scale down to zero.",
        serverless:
          "An invocation that finds no warm instance pays a cold start first (createOrder 2, sendReceipt 1 and dailyReport 1 in the example, with no timing shown). Every accepted createOrder call also goes to the managed store and queue. Real platforms offer provisioned or pre-warmed instances that soften cold starts and cost money while idle.",
      },
    },
    {
      label: "Consistency",
      values: {
        "space-based":
          "The database is eventually consistent: after two purchases it still says seats left 3 until the data writer drains the pump. The units agree here only because this simulation copies each change immediately and handles one request at a time. The page says real grids often replicate asynchronously, so two units can both sell the last seat (a data collision), which the simulation cannot show.",
        serverless:
          "The functions are eventually consistent with each other through the queue: when dailyReport runs, order-3 is counted but still waiting for its receipt (3 orders, 2 receipted). In this example there is one store, so every read sees the latest write. Consistency in a real hosted database depends on the service and its settings.",
      },
    },
    {
      label: "Failure and data loss",
      values: {
        "space-based":
          "A change waiting in the pump exists only in memory in this example: if everything stopped before the drain, the queued writes would be lost. Real products add backups, persistent stores or a mirror service, at a cost.",
        serverless:
          "createOrder saves the order and then enqueues the message as two separate writes. If the instance died between them, the order would exist and nobody would be told. This example has no outbox and no transactional output to close that gap.",
      },
    },
    {
      label: "Idle cost",
      values: {
        "space-based": "Units stay running to hold the data, so they are not scaled to zero.",
        serverless:
          "An idle function costs nothing: the platform reclaims the warm instances (two in the example) and creates new ones only when the next event arrives.",
      },
    },
    {
      label: "Operational cost and complexity",
      values: {
        "space-based":
          "High. It needs a data grid, request routing, a pump, a way to start and stop units, and tests for the failure cases the simulation leaves out. The page calls it niche and expensive to build and to test.",
        serverless:
          "Lower to run, different to debug. There are no servers to manage, but a business action spans functions, queues and tables, so it has to be traced; execution limits, event formats and retries differ between providers.",
      },
    },
    {
      label: "Data size",
      values: {
        "space-based":
          "The data has to fit in memory. Here every unit holds a full copy of the one show; bigger data needs a partitioned grid, which this example does not do.",
        serverless:
          "The data lives in the managed store, not in the instance, so instance memory does not have to hold it.",
      },
    },
  ],
  options: [
    {
      subject: "space-based",
      changes:
        "Requests never wait on the database. Each ProcessingUnit sells from its own in-memory replica, the DataGrid copies the change to the other units and queues it in the DataPump, and the data writer applies the queued writes to the database later. The database says seats left 3 for as long as the writes sit in the pump. Capacity is added by starting another unit, which copies the current data from a peer.",
      chooseWhen: [
        "The load is extreme and spiky, and the database would be the bottleneck however many application servers are added.",
        "The working data is small enough to hold in memory in every unit, or can be partitioned.",
        "A short delay between memory and the database is acceptable, and the team can handle data collisions in a real grid.",
        "The team can build, run and test a data grid and has the tooling to start units automatically.",
      ],
      code: [
        { kind: "architecture", slug: "space-based", region: "processingUnit" },
        { kind: "architecture", slug: "space-based", region: "dataGrid" },
        { kind: "architecture", slug: "space-based", region: "dataPump" },
      ],
      steps: [
        { kind: "architecture", slug: "space-based", step: 3 },
        { kind: "architecture", slug: "space-based", step: 5 },
        { kind: "architecture", slug: "space-based", step: 6 },
      ],
    },
    {
      subject: "serverless",
      changes:
        "The platform runs a function when an event arrives and drops the instance when it is idle. Nothing durable lives in an instance: order ids, orders and queued messages live in OrderStore and MessageQueues. That is why, after the reclaim-idle call drops every warm instance, the next createOrder starts cold with its call counter at 1 and still gives the new order the id order-3.",
      chooseWhen: [
        "Work arrives in bursts or at unpredictable times, or only occasionally, so an always-on server would mostly sit idle.",
        "The work is naturally event-sized: a request, a queue message or a scheduled job that does one thing and ends.",
        "The state already lives in managed services, or can move there.",
        "The team wants the platform to handle scaling and patching rather than run servers or a data grid.",
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
  ],
  noPattern: {
    when: "The load is modest or steady, or an existing database already copes with the bursts. The question was only whether to start a few more instances.",
    instead:
      "Run an ordinary application with a database, add a cache in front for reads, and scale the application by adding instances or by resizing the database. The Space-Based page itself says that for most systems a database with a cache in front is the better answer. Move to Serverless later if the cost of idle servers is the actual complaint.",
  },
  overlap:
    "Both add capacity by starting more copies of the same code, but they keep state in opposite places: Space-Based in the running units, Serverless in managed services outside the instances. A system could use units for one hot, spiky part and functions for the rest, but neither page shows that. Both pages also tie into messaging: the DataPump is a memory-only queue with one consumer, while Serverless uses managed queues between functions.",
  scenario: {
    prompt:
      "A venue sells about 2,000 tickets a month. Most days are quiet; when a popular show is announced a few hundred people arrive over a few minutes. A load test shows the existing relational database handles that burst. The team is small and has never run a data grid. Which fits best?",
    choices: [
      {
        id: "none",
        option: "none",
        label: "Neither: keep the ordinary application and database, add instances if needed",
        verdict: "best",
        explanation:
          "The database is not the bottleneck, so removing it from the request path buys nothing, and a few hundred requests over a few minutes does not call for a new deployment model. Both styles add real cost: a data grid to build and test on one side, cold starts and distributed debugging on the other.",
      },
      {
        id: "serverless",
        option: "serverless",
        label: "Serverless: functions for the endpoints, the existing database for state",
        verdict: "workable",
        explanation:
          "Quiet days and short bursts do fit pay-per-invocation, and no data grid is needed. But it has to earn its keep: if the current application already copes, the move brings cold starts, platform-specific limits and a business action that spans functions and queues, so it is only worth it if the cost of idle servers is the actual complaint.",
      },
      {
        id: "space-based",
        option: "space-based",
        label: "Space-Based: replicated in-memory units with write-behind to the database",
        verdict: "poor",
        explanation:
          "It is built for extreme, spiky load where the database cannot keep up, and the page calls it niche and expensive to build and test. Here the database copes, so the team would take on a data grid, a pump that can lose queued writes if everything stops, and data collisions in a real asynchronous grid, to solve a problem it does not have.",
      },
    ],
  },
};
