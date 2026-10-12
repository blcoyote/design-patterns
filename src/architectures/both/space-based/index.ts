import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { SpaceBasedVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "space-based",
  name: "Space-Based Architecture",
  paradigm: "both",
  order: 18,
  summary:
    "Processing units keep the working data in a replicated in-memory grid, so requests never wait on the database; changes reach the database later through a write-behind data pump, and units are added when load spikes.",
  intent:
    "Space-based architecture (its name comes from the tuple space, a shared memory that processes read and write; it is one of the architecture styles Richards and Ford describe) is built for load that is extreme and spiky, where the database would be the bottleneck however many application servers you add. It removes the database from the request path: every processing unit holds the working data in its own memory and answers from it, a data grid keeps the units' copies in step, and the changes are written to the database afterwards, in the background, by a data pump. Capacity is added by starting more processing units. It is a niche style that is expensive to build and to test, and most systems should not use it.",
  problem:
    "A ticket sale opens and tens of thousands of buyers arrive in the same minute, then the rush is over. Adding web servers does not help when every request ends in the same database: it becomes the bottleneck, and a bigger database costs a lot and still has a ceiling. Caching in front of it does not fix this either, because every purchase is a write, and each write would still have to reach the database before the buyer gets an answer.",
  solution:
    "Take the database out of the request path. Each processing unit holds the data it needs in memory and serves requests from it, reading and changing its own replica. A data grid copies every change to the other units so their replicas stay alike, and forwards each change to a data pump, a queue in front of the database. A data writer drains the pump into the database later, and a data reader loads the database into a unit only on a cold start. A messaging grid spreads incoming requests over the running units, and a deployment manager starts a new unit when load grows: the new unit copies the current data from a peer through the grid. In this example the whole scenario is one show with three seats, three units and four buyers, simulated in one process with no real network.",
  analogy:
    "A ticket office on the night a big tour goes on sale. Each clerk has a copy of the seating plan on a clipboard and sells from it, and each time a clerk sells a seat they call it out so the others can mark their copies. A runner carries the sales slips to the accounts department, which updates the official ledger later. Selling never waits on the ledger, and when the queue grows another clerk is sent to the counter with a copy of the current plan. The risk is also visible: if two clerks sell the last seat before either call is heard, the ledger will have a problem, and the clipboards are not the ledger until the runner has delivered.",
  whenToUse: [
    "The load is extreme and spiky, and the database is the bottleneck: Richards and Ford name ticket sales and online auctions as typical fits, where many users hit the same data at once for a short time.",
    "The working data is small enough to hold in memory in every unit (or can be partitioned, which this example does not do) and a short delay between memory and the database is acceptable.",
    "Elasticity matters more than simplicity: you need to add units quickly when load spikes, and you have the tooling to automate it.",
    "Do NOT use it when the data does not fit in memory, when every read must see the latest committed write (strong consistency), when the load is small or steady (a database with a cache, or a modular monolith, is far simpler), or when the team lacks the operational maturity to run and test a data grid.",
  ],
  pros: [
    "Requests never wait on the database. In the example all four requests (alice, bob, carol, dave) are answered from a unit's memory, and none of them touched the database: after two purchases it still said seats left 3.",
    "Capacity is added by starting a unit. pu-3 is started in the spike, copies show-1 from pu-1 through the grid instead of reading the database, and the next request after that (carol) is routed to it.",
    "A sold-out answer costs almost nothing. dave's request is rejected from pu-1's own memory, and nothing is replicated or queued.",
    "The pump decouples the units from the database's speed. The three changes wait in the pump and the writer applies them in order in one go; in this example a slow database would only delay the drain, not the purchases. Real products can also batch or coalesce the writes.",
  ],
  cons: [
    "It is niche, complex and costly. You need a data grid, routing, a pump, a way to start and stop units, and tests for all of it, including the failure cases that this simulation does not have. For most systems a database with a cache in front is the better answer.",
    "The data must fit in memory. Here every running unit holds a full copy of the one show. A data set that is too big for that needs a partitioned grid, which is more complicated and not what this example does.",
    "The database is behind. After alice and bob the database still says seats left 3 while two seats are sold; anything that reads it directly sees old data until the drain. That is eventual consistency, and it is not suited to cases where every read must see the latest write.",
    "A queued change is only as safe as the pump. In this example the pump is also only memory, so if everything stopped before the drain the two queued writes would be lost and the next cold start would read seats left 3 from the database. Real products offer backups, persistent stores or a mirror service to reduce this, at a cost.",
    "This simulation replicates every change to the other units immediately and handles one request at a time. Real grids usually replicate asynchronously, so for a moment two units can hold different values and both sell the last seat: a data collision. The example cannot show that, and handling collisions is a large part of the real work.",
    "It is hard to run and to test: starting and stopping units, joining a grid while changes are in flight, and recovering after a failure are all things to design for. This example has none of it.",
  ],
  realWorld: [
    "Richards and Ford describe the style in Fundamentals of Software Architecture and name concert ticketing and online auction sites as the kind of system that fits it.",
    "GigaSpaces XAP is a platform built around this idea, with processing units, an in-memory data grid and a mirror service that persists changes to the database asynchronously. The pump in this example plays the part of that persistence, in a much simpler form.",
    "Hazelcast, Apache Ignite and Oracle Coherence are in-memory data grids. Each can be set up with a write-behind store, where changes to the grid are written to a database after a delay. Which products offer which options, and with what guarantees, differs between them and between versions; check the documentation of the one you use.",
    "Whether a given system is a space-based architecture or simply uses a data grid as a cache is a matter of degree: the defining move is that the grid, not the database, is what the requests are answered from.",
  ],
  concepts: [
    {
      term: "Processing unit",
      description:
        "The thing that runs the application code, here ProcessingUnit with a name and a private in-memory replica of the data (a map of show id to ShowRecord, in insertion order). buy reads the local record, makes a new record with one seat less, stores it locally, asks the grid to replicate it and answers. It never touches the database. A show it does not hold is a programmer bug: an exception in TypeScript, C# and Python, a returned error in Go (not exercised).",
    },
    {
      term: "Data grid (replication)",
      description:
        "Knows the running units in join order and keeps their replicas alike. join makes a new unit copy every record from the first member (if there is one) and then adds it. replicate puts a changed record into every member except the source, iterating a snapshot of the members, and then forwards the change to the pump. That forwarding is the write-behind. Here it copies immediately; real grids usually replicate asynchronously.",
    },
    {
      term: "Data pump",
      description:
        "A first in first out queue of SeatWrite values (show id, new seats left, buyer) with send and size. The grid sends to it, and only the data writer takes from it. It is what makes the database write happen later instead of during the purchase.",
    },
    {
      term: "Data writer and data reader",
      description:
        "Both are small helpers around the database. The writer is the only code that writes to it: drain applies every queued write in order, counts them and prints one line. The reader is the only code that reads it for a unit: load copies every database record into the unit, and is used only when the grid has no members yet (a cold start). In TypeScript, C# and Python they are static methods; in Go they are methods on an empty struct.",
    },
    {
      term: "Messaging grid",
      description:
        "Receives a request and hands it to one running unit. Here that is round robin: the member at counter modulo the member count, in join order, then the counter goes up. alice goes to pu-1 (0 % 2), bob to pu-2 (1 % 2), carol to pu-3 (2 % 3) and dave to pu-1 (3 % 3). Real messaging grids can also route by load or by the data a request needs.",
    },
    {
      term: "Deployment manager",
      description:
        "Starts units when load calls for it. The first unit finds an empty grid and is filled by the data reader from the database; later units copy from a peer through the grid. Here main decides when to start one; a real deployment manager can watch load and also stop units.",
    },
    {
      term: "Processing grid",
      description:
        "Richards and Ford list an optional fourth part of the virtualized middleware: a processing grid that coordinates a request that needs several kinds of processing units. This example has no such request, so it has no processing grid.",
    },
    {
      term: "Data collision",
      description:
        "Two units change the same data in the window before their replicas meet, for example both selling the last seat. It can only happen when replication is asynchronous. This example copies each change at once and runs one request at a time, so it cannot show one.",
    },
    {
      term: "Write-behind",
      description:
        "A change is acknowledged first and written to the database afterwards. In this example the data grid forwards every change to the pump and the data writer applies them when it is told to; after two purchases the database still says seats left 3 and the pump holds 2 writes.",
    },
  ],
  variants: [
    {
      name: "Replicated or partitioned grid",
      description:
        "This example is fully replicated: every running unit ends up with every record. Grids that hold more data than one machine can fit usually partition it, so each member holds a slice plus backups. That scales to bigger data sets but makes a request that needs another member's slice more complicated.",
    },
    {
      name: "Asynchronous replication",
      description:
        "Real grids often copy a change to the other members in the background instead of before answering. That is faster and is where data collisions come from. This simulation copies each change immediately.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "pub-sub",
        why: "The data grid pushes each change to every other member without the unit that made it knowing who they are: replicate puts the new record into all members except the source, in join order. It is only a simple form of publish-subscribe: the grid is a plain member list that it calls directly and at once, with no topics, broker or subscriptions.",
      },
      {
        slug: "outbox",
        why: "The data pump is a queue of changes that are applied to the database later, in order, like the backlog of an outbox. It is weaker than a real outbox: the change goes into an in-memory queue, not into the same database transaction as the data, so it would be lost if the process stopped before the drain, and the writer applies the changes to the database instead of publishing them to a broker.",
      },
      {
        slug: "cache-aside",
        why: "A contrast, not a use. A processing unit's replica looks like a cache, but it is not cache-aside: the unit does not check a cache and fall back to the database on a miss, and writes do not go to the database first with the cache invalidated. The replica is the working copy, writes reach the database later through the pump, and the database is read only on a cold start, by the data reader.",
      },
    ],
    architectures: [
      {
        slug: "event-driven",
        why: "The data pump is an event queue in its smallest form, and not an EventBroker. DataPump is an in-memory first in first out queue of SeatWrite values that DataWriter.drain empties when it is called, as EventBroker.drain empties its queue. But it has one consumer, the writer, and no topics or subscribers, so it is a queue and not a broker. DataGrid.replicate does not use it either: it calls each member's put directly, in join order, instead of publishing to whoever subscribed. The pump serves to decouple the units from the speed of the database, where EventBroker decouples producers from consumers they have never heard of.",
      },
      {
        slug: "microservices",
        why: "Both run a system as several deployed pieces, but the pieces differ. A microservice does its own job: OrderService, InventoryService and PaymentsService are separate services that call each other, through InventoryServiceClient and a circuit breaker, and OrderService and InventoryService each keep their own private data. A ProcessingUnit is a copy of the same application: pu-1, pu-2 and pu-3 all hold show-1, and a buy is answered from the unit's own replica, which DataGrid.replicate then copies to the others. The styles can be combined, with units for one hot, spiky part of a system and services for the rest, but neither page shows that.",
      },
      {
        slug: "serverless",
        why: "Both start more copies of the same code when load grows, but they keep state in opposite places. On the Serverless page a function instance relies on nothing in its own memory: OrderStore and MessageQueues stand for managed services outside it, and reclaimIdle drops every warm instance. Here the state is in the units: a ProcessingUnit's memory is the working copy, DataGrid.replicate keeps the copies alike, and DeploymentManager.start gives a new unit a copy from a peer. A unit therefore has to stay running to hold the data and is not scaled to zero, and a change waiting in DataPump exists only in memory until DataWriter.drain applies it to the database.",
      },
    ],
  },

  viewBox: "0 0 1200 800",
  participants: [
    {
      id: "client",
      label: "Buyers",
      role: "Client",
      kind: "client",
      x: 200,
      y: 100,
      width: 150,
      description:
        "The usage code. It starts pu-1 and pu-2, buys a seat for alice and bob, prints what the database and the pump hold, starts pu-3 for the spike, buys for carol and dave and finally drains the pump. Requests go to the messaging grid; the buyers never choose a unit.",
      code: "usage",
    },
    {
      id: "messagingGrid",
      label: "Messaging grid",
      role: "Request routing",
      kind: "class",
      x: 600,
      y: 100,
      width: 200,
      description:
        "Takes a buy request and hands it to one running unit: round robin over a snapshot of the members at that moment, in join order, with a counter taken modulo the member count and then incremented. It returns the unit's answer. alice goes to pu-1, bob to pu-2, carol to pu-3 and dave to pu-1. Real messaging grids can also route by load or by the data a request needs.",
      code: "messagingGrid",
    },
    {
      id: "pu1",
      label: "pu-1",
      role: "Processing unit",
      kind: "class",
      x: 300,
      y: 300,
      width: 190,
      description:
        "The first unit started. It finds an empty grid, so the data reader fills it from the database. It answers requests from its own in-memory replica and never touches the database; the change from a purchase is copied by the grid to the other units. This is not cache-aside: its replica is the working copy, and there is no read of the database on a miss.",
      patterns: ["cache-aside"],
      code: "processingUnit",
    },
    {
      id: "pu2",
      label: "pu-2",
      role: "Processing unit",
      kind: "class",
      x: 600,
      y: 300,
      width: 190,
      description:
        "The second unit. It joins through the grid and copies show-1 from pu-1, not from the database. From then on it keeps its replica alike through the grid, and answers bob's request.",
      code: "processingUnit",
    },
    {
      id: "pu3",
      label: "pu-3",
      role: "Processing unit (the spike)",
      kind: "class",
      x: 900,
      y: 300,
      width: 190,
      description:
        "Not running until the spike. The deployment manager starts it in step 7, it copies show-1 from pu-1 with seats left 1, and the next request (carol) is routed to it. Until then it is not a member of the grid and receives nothing.",
      code: "processingUnit",
    },
    {
      id: "dataGrid",
      label: "Data grid (replication)",
      role: "Virtualized middleware",
      kind: "class",
      x: 600,
      y: 500,
      width: 240,
      description:
        "Knows the running units in join order. join copies every record from the first member to a new unit; replicate puts a changed record into every other member (over a snapshot of the members) and then sends the change to the data pump, which is the write-behind. This simulation copies immediately and handles one request at a time; real grids usually replicate asynchronously, so two units can both sell the last seat (a data collision), which this example cannot show.",
      patterns: ["pub-sub"],
      code: "dataGrid",
    },
    {
      id: "deploymentManager",
      label: "Deployment manager",
      role: "Virtualized middleware",
      kind: "class",
      x: 1020,
      y: 500,
      width: 210,
      description:
        "Starts a processing unit: it prints [deploy] starting, creates the unit, uses the data reader if the grid has no members, and then joins the unit to the grid. It starts pu-1 and pu-2 at the beginning and pu-3 when the spike comes; here main decides when. A real deployment manager can also watch load and stop units.",
      code: "deploymentManager",
    },
    {
      id: "dataPump",
      label: "Data pump",
      role: "Write-behind queue",
      kind: "object",
      x: 980,
      y: 720,
      width: 170,
      description:
        "A first in first out queue of SeatWrite values. The data grid sends each change to it, and only the data writer takes from it. It holds 2 writes after bob's purchase and 3 after carol's. In this example it is memory only: nothing makes it durable.",
      patterns: ["outbox"],
      code: "dataPump",
    },
    {
      id: "dataWriter",
      label: "Data writer",
      role: "Applies queued writes",
      kind: "class",
      x: 680,
      y: 720,
      width: 170,
      description:
        "The only code that writes to the database. It runs when drain is called and nothing here decides when. drain takes the writes from the pump one by one, applies each to the database in the order sent and counts them, then prints [writer] applied 3 writes; database: show-1 seats left: 0. A static method in TypeScript, C# and Python, a method on an empty struct in Go.",
      code: "dataPump",
    },
    {
      id: "database",
      label: "Database",
      role: "System of record",
      kind: "object",
      x: 380,
      y: 720,
      width: 150,
      description:
        "The slow, durable store with one show, show-1, capacity 3 and seats left 3 at the start. No purchase touches it: the data reader loads from it on a cold start and the data writer applies the queued writes to it. It says seats left 3 until the drain, then seats left 0.",
      code: "database",
    },
    {
      id: "dataReader",
      label: "Data reader",
      role: "Cold-start loader",
      kind: "class",
      x: 120,
      y: 720,
      width: 170,
      description:
        "The only code that reads the database for a unit. load copies every database record into the unit and prints one line per record. It is used only when the grid has no members yet, which here is pu-1's start. A static method in TypeScript, C# and Python, a method on an empty struct in Go.",
      code: "dataReader",
    },
  ],
  relations: [
    {
      id: "buy",
      from: "client",
      to: "messagingGrid",
      type: "calls",
      label: "buy",
      description:
        "A buy request from outside: the buyer's name and the show. The messaging grid decides which unit answers, and the buyer gets the unit's answer back: true for a sale, false when the show is sold out.",
      code: "usage",
    },
    {
      id: "route1",
      from: "messagingGrid",
      to: "pu1",
      type: "calls",
      label: "route",
      description:
        "The messaging grid hands the request to pu-1 (the member at counter modulo the member count) and returns its answer. alice and, once there are three members, dave are routed here.",
      code: "messagingGrid",
    },
    {
      id: "route2",
      from: "messagingGrid",
      to: "pu2",
      type: "calls",
      label: "route",
      description: "bob's request goes to pu-2: 1 % 2 = 1.",
      code: "messagingGrid",
    },
    {
      id: "route3",
      from: "messagingGrid",
      to: "pu3",
      type: "calls",
      label: "route",
      description:
        "carol's request goes to pu-3: with three members the counter is 2 and 2 % 3 = 2.",
      code: "messagingGrid",
    },
    {
      id: "replicate1",
      from: "pu1",
      to: "dataGrid",
      type: "calls",
      label: "replicate",
      description:
        "After a sale pu-1 asks the grid to replicate the new record. The grid copies it to every other member and forwards the change to the pump. The copies to pu-1 itself, when another unit made the change, play in the other direction along this arrow.",
      code: "dataGrid",
    },
    {
      id: "replicate2",
      from: "pu2",
      to: "dataGrid",
      type: "calls",
      label: "replicate",
      description:
        "The same call from pu-2. When another unit made a change, the copy to pu-2 arrives along this arrow in the other direction.",
      code: "dataGrid",
    },
    {
      id: "replicate3",
      from: "pu3",
      to: "dataGrid",
      type: "calls",
      label: "replicate",
      description:
        "The same call from pu-3, which sold carol the last seat. Once pu-3 is a member, copies to it arrive along this arrow in the other direction.",
      code: "dataGrid",
    },
    {
      id: "writeBehind",
      from: "dataGrid",
      to: "dataPump",
      type: "calls",
      label: "write-behind",
      description:
        "After copying a change to the other units the grid sends it to the pump as a SeatWrite: the show, the new seats left and the buyer. Every change goes there; the grid does not write to the database itself.",
      code: "dataGrid",
    },
    {
      id: "drain",
      from: "dataPump",
      to: "dataWriter",
      type: "calls",
      label: "drain",
      description:
        "The data writer takes the oldest write from the pump, again and again, until the pump is empty. Nothing else takes from the pump.",
      code: "dataPump",
    },
    {
      id: "apply",
      from: "dataWriter",
      to: "database",
      type: "calls",
      label: "apply",
      description:
        "The writer applies each write to the database, which stores the write's seats left for that show. Writes are applied in the order they were sent, one at a time.",
      code: "dataPump",
    },
    {
      id: "read",
      from: "database",
      to: "dataReader",
      type: "calls",
      label: "read",
      description:
        "The data reader reads every record from the database. This happens only for a cold start, when the grid has no members yet.",
      code: "dataReader",
    },
    {
      id: "load",
      from: "dataReader",
      to: "pu1",
      type: "calls",
      label: "load",
      description:
        "The reader puts each record into the new unit's replica. In this scenario that is pu-1, the first unit; later units copy from a peer through the grid instead.",
      code: "dataReader",
    },
    {
      id: "join",
      from: "deploymentManager",
      to: "dataGrid",
      type: "calls",
      label: "join",
      description:
        "A new unit joins the grid. If there are members, the grid first copies every record from the first member into the new unit, printing a line per record, and then adds the unit. For the very first unit it copies nothing.",
      code: "deploymentManager",
    },
  ],

  steps: [
    {
      title: "Units answer from memory; the database lags behind",
      description:
        "Buyers' requests go through the messaging grid to one of the processing units, and each unit answers from its own in-memory replica of the data. Nothing in a purchase touches the database. The data grid keeps the replicas alike and forwards every change to the data pump, and the data writer applies the queued changes to the database later. At the start only pu-1 and pu-2 are started; pu-3 is added when the spike comes in step 7. The dashed boxes group the units, and the data tier. This is a simulation: it replicates at once and handles one request at a time.",
      highlight: [
        "client",
        "messagingGrid",
        "pu1",
        "pu2",
        "dataGrid",
        "dataPump",
        "dataWriter",
        "database",
      ],
      notes: {
        pu1: "answers from memory",
        pu3: "not running yet",
        database: "behind the pump",
      },
      code: "usage",
    },
    {
      title: "pu-1 starts on an empty grid and is loaded by the reader",
      description:
        "main asks the deployment manager to start pu-1 and it prints '[deploy] starting pu-1'. The grid has no members yet, so there is no peer to copy from and the data reader loads show-1 from the database into the new unit: '[reader] pu-1 loaded show-1 from the database (seats left: 3)'. Then the unit joins the grid, which copies nothing because pu-1 is the first member. The database is read like this only for a cold start.",
      highlight: ["deploymentManager", "database", "read", "dataReader", "load", "pu1"],
      packets: [
        { relation: "read", label: "show-1 (3 left)" },
        { relation: "load", label: "show-1", after: 0 },
      ],
      notes: {
        deploymentManager: "starting pu-1",
        dataReader: "loaded show-1",
        pu1: "seats left: 3",
        pu3: "not running yet",
      },
      code: "deploymentManager",
    },
    {
      title: "pu-2 copies the data from pu-1, not from the database",
      description:
        "The deployment manager starts pu-2: '[deploy] starting pu-2'. The grid now has a member, so the reader is not used. The unit joins the grid, and the grid copies every record from the first member into it: '[grid] pu-2 copied show-1 from pu-1 (seats left: 3)'. Then pu-2 is a member, and from now on it is kept in step by the grid.",
      highlight: [
        "deploymentManager",
        "join",
        "dataGrid",
        "replicate1",
        "pu1",
        "replicate2",
        "pu2",
      ],
      packets: [
        { relation: "join", label: "join pu-2" },
        { relation: "replicate1", label: "read show-1", after: 0 },
        { relation: "replicate2", label: "copy show-1", reverse: true, after: 1 },
      ],
      notes: {
        deploymentManager: "starting pu-2",
        dataGrid: "pu-2 copied from pu-1",
        pu2: "seats left: 3",
        pu3: "not running yet",
      },
      code: "dataGrid",
    },
    {
      title: "alice is routed to pu-1: seat 1",
      description:
        "The buyers call the messaging grid's buy for alice. The routing counter is 0 and there are 2 members, so 0 % 2 = 0 and she is routed to pu-1. pu-1 reads its own record (seats left 3), works out seat = 3 - 3 + 1 = 1 and stores a new record with seats left 2. It then asks the grid to replicate: the grid puts the record into pu-2 and sends a write (show-1, seats left 2, alice) to the pump. Only then does pu-1 print '[pu-1] alice gets seat 1 (seats left: 2)' and return true. The database is not involved.",
      highlight: [
        "client",
        "buy",
        "messagingGrid",
        "route1",
        "pu1",
        "replicate1",
        "dataGrid",
        "replicate2",
        "pu2",
        "writeBehind",
        "dataPump",
      ],
      packets: [
        { relation: "buy", label: "alice" },
        { relation: "route1", label: "alice", after: 0 },
        { relation: "replicate1", label: "seats left 2", after: 1 },
        { relation: "replicate2", label: "copy: 2 left", reverse: true, after: 2 },
        { relation: "writeBehind", label: "write: 2 left", after: 3 },
        { relation: "route1", label: "true", reverse: true, after: 4 },
        { relation: "buy", label: "true", reverse: true, after: 5 },
      ],
      notes: {
        pu1: "seat 1, 2 left",
        pu2: "replica: 2 left",
        pu3: "not running yet",
      },
      code: "processingUnit",
    },
    {
      title: "bob is routed to pu-2: seat 2",
      description:
        "bob's request: the counter is 1 and 1 % 2 = 1, so it goes to pu-2. pu-2's replica already says seats left 2 (the grid copied it after alice), so seat = 3 - 2 + 1 = 2 and the new record has seats left 1. The grid copies it to pu-1 and sends a second write to the pump, which now holds 2 writes. pu-2 prints '[pu-2] bob gets seat 2 (seats left: 1)'.",
      highlight: [
        "client",
        "buy",
        "messagingGrid",
        "route2",
        "pu2",
        "replicate2",
        "dataGrid",
        "replicate1",
        "pu1",
        "writeBehind",
        "dataPump",
      ],
      packets: [
        { relation: "buy", label: "bob" },
        { relation: "route2", label: "bob", after: 0 },
        { relation: "replicate2", label: "seats left 1", after: 1 },
        { relation: "replicate1", label: "copy: 1 left", reverse: true, after: 2 },
        { relation: "writeBehind", label: "write: 1 left", after: 3 },
        { relation: "route2", label: "true", reverse: true, after: 4 },
        { relation: "buy", label: "true", reverse: true, after: 5 },
      ],
      notes: {
        pu2: "seat 2, 1 left",
        pu1: "replica: 1 left",
        dataPump: "2 writes",
        pu3: "not running yet",
      },
      code: "processingUnit",
    },
    {
      title: "The database still says 3: write-behind",
      description:
        "main prints 'database: show-1 seats left: 3, pump holds 2 writes'. Two seats are sold, and the units agree that 1 is left, but the database has seen neither purchase: it still says 3. The writes wait in the pump until the data writer is told to drain it. This is write-behind, and what makes the purchases fast also makes the database eventually consistent, so anything that reads the database directly now sees old data. It is also a risk: if everything stopped here, the two queued writes would be lost.",
      highlight: ["dataPump", "database"],
      notes: {
        database: "seats left: 3",
        dataPump: "2 writes",
        pu3: "not running yet",
      },
      code: "usage",
    },
    {
      title: "The spike: pu-3 starts and copies from pu-1",
      description:
        "Load is up, so main asks the deployment manager to start pu-3: '[deploy] starting pu-3'. The grid has members, so the reader is not used; the grid copies every record from its first member into the new unit: '[grid] pu-3 copied show-1 from pu-1 (seats left: 1)'. pu-3 starts with the current state, seats left 1, which is newer than the database's 3, and joins the grid. From now on there are 3 members, so the routing counter is taken modulo 3.",
      highlight: [
        "deploymentManager",
        "join",
        "dataGrid",
        "replicate1",
        "pu1",
        "replicate3",
        "pu3",
      ],
      packets: [
        { relation: "join", label: "join pu-3" },
        { relation: "replicate1", label: "read show-1", after: 0 },
        { relation: "replicate3", label: "copy show-1", reverse: true, after: 1 },
      ],
      notes: {
        deploymentManager: "starting pu-3",
        dataGrid: "pu-3 copied from pu-1",
        pu3: "seats left: 1",
      },
      code: "deploymentManager",
    },
    {
      title: "carol is routed to pu-3: the last seat",
      description:
        "carol's request: the counter is 2 and 2 % 3 = 2, so it goes to pu-3, the new unit. Its replica says seats left 1, so seat = 3 - 1 + 1 = 3 and the new record has seats left 0. The grid copies it to pu-1 and then to pu-2, in join order, and sends a third write to the pump. pu-3 prints '[pu-3] carol gets seat 3 (seats left: 0)'. Because this simulation copies immediately and handles one request at a time, no other unit can sell that seat in the meantime; a real grid usually replicates asynchronously, so two units could both sell it. This simulation cannot show that.",
      highlight: [
        "client",
        "buy",
        "messagingGrid",
        "route3",
        "pu3",
        "replicate3",
        "dataGrid",
        "replicate1",
        "pu1",
        "replicate2",
        "pu2",
        "writeBehind",
        "dataPump",
      ],
      packets: [
        { relation: "buy", label: "carol" },
        { relation: "route3", label: "carol", after: 0 },
        { relation: "replicate3", label: "seats left 0", after: 1 },
        { relation: "replicate1", label: "copy: 0 left", reverse: true, after: 2 },
        { relation: "replicate2", label: "copy: 0 left", reverse: true, after: 3 },
        { relation: "writeBehind", label: "write: 0 left", after: 4 },
        { relation: "route3", label: "true", reverse: true, after: 5 },
        { relation: "buy", label: "true", reverse: true, after: 6 },
      ],
      notes: {
        pu3: "seat 3, 0 left",
        pu1: "replica: 0 left",
        pu2: "replica: 0 left",
        dataPump: "3 writes",
      },
      code: "processingUnit",
    },
    {
      title: "dave is rejected: sold out, answered from memory",
      description:
        "dave's request: the counter is 3 and 3 % 3 = 0, so it goes to pu-1. Its replica says seats left 0, so it prints '[pu-1] dave rejected: show-1 is sold out' and returns false. Nothing is replicated and nothing is queued, so the pump still holds 3 writes. The database was not asked either: the answer came from pu-1's memory.",
      highlight: ["client", "buy", "messagingGrid", "route1", "pu1"],
      packets: [
        { relation: "buy", label: "dave" },
        { relation: "route1", label: "dave", after: 0 },
        { relation: "route1", label: "false: sold out", reverse: true, after: 1 },
        { relation: "buy", label: "false: sold out", reverse: true, after: 2 },
      ],
      notes: {
        pu1: "sold out, from memory",
        dataPump: "still 3 writes",
      },
      code: "processingUnit",
    },
    {
      title: "The data writer drains the pump; the database catches up",
      description:
        "main calls the data writer's drain. It takes the writes from the pump one at a time and applies each to the database in the order they were sent: seats left 2 (alice), 1 (bob) and 0 (carol). It prints '[writer] applied 3 writes; database: show-1 seats left: 0'. Only now does the database agree with the units. That is eventual consistency: the database was behind for the whole time between the first purchase and this drain, and nothing in this example decided when it would catch up other than this call.",
      highlight: ["dataPump", "drain", "dataWriter", "apply", "database"],
      packets: [
        { relation: "drain", label: "take: 2 left" },
        { relation: "apply", label: "apply: 2 left", after: 0 },
        { relation: "drain", label: "take: 1 left", after: 1 },
        { relation: "apply", label: "apply: 1 left", after: 2 },
        { relation: "drain", label: "take: 0 left", after: 3 },
        { relation: "apply", label: "apply: 0 left", after: 4 },
      ],
      notes: {
        dataWriter: "applied 3 writes",
        database: "seats left: 0",
      },
      code: "dataPump",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: SpaceBasedVisualization,
};
