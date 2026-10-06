import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { UnitOfWorkVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "unit-of-work",
  name: "Unit of Work",
  category: "enterprise",
  order: 3,
  summary:
    "Collect every insert, update and delete from a business operation, then commit them as a single transaction — or not at all.",
  intent:
    "Track all the changes made during one business operation and write them out together, so either everything is saved or nothing is.",
  problem:
    "A checkout touches several rows: a new Order is inserted, the Customer's loyalty points are updated, and a stale Cart is deleted. If each change is saved the instant it happens, a crash halfway through leaves the database in a state no business rule allows, such as an Order inserted but the loyalty points never awarded, or points awarded for a purchase that never completed. Nothing holds the whole operation together as one transaction.",
  solution:
    "Give each business operation a UnitOfWork. Instead of saving anything the moment it changes, application code just reports what happened (registerNew, registerDirty, registerRemoved), and the UnitOfWork keeps each object in the right pending list. Only when the caller calls commit() does it open a single database transaction, write every pending insert, update and delete through it, and commit. If any write fails, the whole transaction rolls back and none of the changes take effect.",
  analogy:
    "A restaurant order pad. A server does not walk to the kitchen after writing down each item. They collect the whole table's order first, then send it in as one ticket. If the kitchen cannot make one of the dishes, the whole ticket is handed back, instead of half the meal silently never arriving.",
  whenToUse: [
    "One business operation touches several objects that must be saved together or not at all.",
    "You need one place to decide the order of writes (inserts before updates before deletes, say), regardless of when the application code made each change.",
  ],
  pros: [
    "Changes commit as one atomic transaction, so a partial failure leaves no partial state behind.",
    "Opens the door to batching: once all changes are collected in one place, an ORM can combine them into fewer round trips. This example still issues one statement per entity; batching would be a further optimization on top.",
    'Separates "what changed", tracked by the UnitOfWork as it happens, from "when it gets written", decided once by commit().',
  ],
  cons: [
    "Adds bookkeeping: every change has to be registered instead of just saved directly.",
    "A long-lived Unit of Work can build up large pending lists and hold locks or memory longer than it should.",
    "It is easy to forget to register a change, which means a write silently never happens. Real ORMs (EF Core, Hibernate, SQLAlchemy) detect modifications to loaded objects automatically; you still add() new objects and remove() deleted ones, though cascades can cover related objects.",
  ],
  realWorld: [
    "Entity Framework Core's DbContext — SaveChanges() flushes every tracked Added/Modified/Deleted entity in one transaction.",
    "Hibernate / NHibernate's Session, which tracks the changes you make and flushes them together to the database.",
    "SQLAlchemy's Session object, which tracks new and changed objects, flushes them inside one transaction (automatically before queries, and at commit), and makes them permanent on session.commit().",
  ],
  related: ["repository", "command", "memento", "outbox"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Application code",
      kind: "client",
      x: 100,
      y: 130,
      width: 130,
      description:
        "Runs one business operation. It never issues SQL directly — it just tells the UnitOfWork what it did (registerNew/Dirty/Removed), then calls commit() once the operation is complete.",
    },
    {
      id: "unitOfWork",
      label: "UnitOfWork",
      role: "Unit of Work",
      kind: "class",
      x: 340,
      y: 130,
      width: 170,
      description:
        "Keeps three lists — newObjects, dirtyObjects, removedObjects — and fills them as the client registers changes. commit() opens one transaction, flushes every pending write through it in order, and clears the lists only if the transaction succeeds.",
    },
    {
      id: "database",
      label: "Database",
      role: "Data store",
      kind: "class",
      x: 680,
      y: 130,
      width: 150,
      description:
        "Executes the actual BEGIN, INSERT/UPDATE/DELETE and COMMIT or ROLLBACK statements. It has no idea these writes were collected up front — from its side, commit() just looks like one ordinary transaction.",
    },
    {
      id: "pendingNew",
      label: "newObjects[]",
      role: "New list",
      kind: "object",
      x: 170,
      y: 330,
      width: 140,
      description:
        "Objects created during this operation that have never been saved. commit() will INSERT each one.",
    },
    {
      id: "pendingDirty",
      label: "dirtyObjects[]",
      role: "Dirty list",
      kind: "object",
      x: 400,
      y: 330,
      width: 150,
      description:
        "Previously-saved objects that were modified. registerDirty() only adds an object here if it is not already tracked as new or dirty, so repeated edits do not queue repeated UPDATEs.",
    },
    {
      id: "pendingRemoved",
      label: "removedObjects[]",
      role: "Removed list",
      kind: "object",
      x: 630,
      y: 330,
      width: 150,
      description:
        "Objects marked for deletion. registerRemoved() also strips the object out of the new/dirty lists first — there is no point inserting or updating something you are about to delete.",
    },
  ],
  relations: [
    {
      id: "register",
      from: "client",
      to: "unitOfWork",
      type: "calls",
      label: "register*()",
      description:
        "The client reports every creation, change and deletion as it happens during the operation. The UnitOfWork only files the object away — it does not touch the database yet.",
      code: "register",
      bend: -22,
    },
    {
      id: "commitCall",
      from: "client",
      to: "unitOfWork",
      type: "calls",
      label: "commit()",
      description:
        "Once the business operation is logically complete, the client calls commit() exactly once to flush everything that was registered.",
      code: "commit",
      bend: 22,
    },
    {
      id: "uowNew",
      from: "unitOfWork",
      to: "pendingNew",
      type: "holds",
      label: "newObjects",
      description:
        "The UnitOfWork owns this list directly — nothing outside it ever reads or writes newObjects[] itself.",
      code: "pendingNew",
      bend: -12,
    },
    {
      id: "uowDirty",
      from: "unitOfWork",
      to: "pendingDirty",
      type: "holds",
      label: "dirtyObjects",
      description: "The second of the three pending lists, filled by registerDirty().",
      code: "pendingDirty",
    },
    {
      id: "uowRemoved",
      from: "unitOfWork",
      to: "pendingRemoved",
      type: "holds",
      label: "removedObjects",
      description:
        "The third pending list, filled by registerRemoved() — and the one commit() flushes last.",
      code: "pendingRemoved",
      bend: 12,
    },
    {
      id: "flush",
      from: "unitOfWork",
      to: "database",
      type: "calls",
      label: "BEGIN … COMMIT",
      description:
        "commit() wraps every pending insert, update and delete in a single database transaction. If every write succeeds the transaction commits; if any one of them throws, the UnitOfWork rolls the whole thing back instead.",
      code: "commit",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "A new Order is created",
      description:
        'Inside a single checkout operation, the application constructs a new Order and calls uow.registerNew(order). The UnitOfWork does not touch the database — it just files the object under its pending "new" list.',
      highlight: ["client", "register", "unitOfWork", "uowNew", "pendingNew"],
      packets: [{ relation: "register", label: "registerNew(order)" }],
      notes: { unitOfWork: "new: 1" },
      code: "registerNew",
    },
    {
      title: "An existing Customer is modified",
      description:
        'The same operation updates the Customer\'s loyalty points in memory and calls uow.registerDirty(customer). It is filed under "dirty" — still nothing has been written to the database.',
      highlight: ["client", "register", "unitOfWork", "uowDirty", "pendingDirty"],
      packets: [{ relation: "register", label: "registerDirty(customer)" }],
      notes: { unitOfWork: "dirty: 1" },
      code: "registerDirty",
    },
    {
      title: "A stale Cart is deleted",
      description:
        'The now-emptied Cart is marked for deletion with uow.registerRemoved(cart). It moves to the "removed" list — again, no DELETE has reached the database yet.',
      highlight: ["client", "register", "unitOfWork", "uowRemoved", "pendingRemoved"],
      packets: [{ relation: "register", label: "registerRemoved(cart)" }],
      notes: { unitOfWork: "removed: 1" },
      code: "registerRemoved",
    },
    {
      title: "A duplicate registration is ignored",
      description:
        "Something elsewhere in the operation calls registerDirty(customer) again. registerDirty checks both the new and dirty lists first, so the Customer is not queued twice — commit() will still only update it once.",
      highlight: ["unitOfWork", "uowDirty", "pendingDirty"],
      notes: { unitOfWork: "dirty: 1 (unchanged)" },
      code: "registerDirty",
    },
    {
      title: "commit() opens a transaction",
      description:
        "The client calls uow.commit(). The UnitOfWork does not flush object by object — it opens one database transaction first, so every pending write can succeed or fail together as a single unit.",
      highlight: ["client", "commitCall", "unitOfWork", "flush", "database"],
      packets: [{ relation: "commitCall", label: "commit()" }],
      notes: { database: "BEGIN" },
      code: "commit",
    },
    {
      title: "Every pending change flushes together",
      description:
        "Inside that one transaction, the UnitOfWork inserts the new Order, updates the Customer, and deletes the Cart — in that order — all through the same connection.",
      highlight: [
        "unitOfWork",
        "pendingNew",
        "pendingDirty",
        "pendingRemoved",
        "flush",
        "database",
      ],
      packets: [{ relation: "flush", label: "INSERT/UPDATE/DELETE" }],
      notes: { database: "3 writes pending" },
      code: "commit",
    },
    {
      title: "COMMIT succeeds",
      description:
        "All three writes succeeded, so the transaction commits. The UnitOfWork clears its new/dirty/removed lists — there is nothing left to flush until the next business operation registers more changes.",
      highlight: ["unitOfWork", "flush", "database"],
      packets: [{ relation: "flush", label: "COMMIT", reverse: true }],
      notes: { unitOfWork: "cleared", database: "COMMIT ✓" },
      code: "commit",
    },
    {
      title: "A different commit fails — and rolls back",
      description:
        "In another operation (Order #105, Customer #61, Cart #12), the UPDATE to Customer #61 violates a constraint partway through the flush — before the removed-list deletes even run. The UnitOfWork catches the failure and issues ROLLBACK instead of COMMIT: the Order #105 INSERT that already ran is undone, and the Cart #12 DELETE further down the list never runs at all.",
      highlight: ["unitOfWork", "flush", "database"],
      packets: [{ relation: "flush", label: "ROLLBACK", reverse: true }],
      notes: { unitOfWork: "pending kept", database: "ROLLBACK ✗" },
      code: "commit",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: UnitOfWorkVisualization,
};
