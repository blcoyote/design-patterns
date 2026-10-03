import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "factory-method",
  name: "Factory Method",
  category: "creational",
  order: 2,
  summary: "Delegate product creation through a creator abstraction.",
  intent:
    "Let a specialized creator decide which concrete product to create, so client code only depends on the product interface. Class-based versions use a subclass override; Go uses a creator interface and shared function.",
  problem:
    "A delivery planner needs a vehicle that depends on the kind of logistics company. If the shared planning code hard-codes `new Truck()`, adding sea or air delivery means rewriting that logic instead of supplying a different creator.",
  solution:
    'Move the "create the vehicle" step into a factory method, createTransport(), and let each creator supply the Transport it needs. In TypeScript, C#, and Python, subclasses override the method used by shared planning code; Go expresses the same separation with a Logistics interface and a PlanDelivery function that calls CreateTransport().',
  analogy:
    'A logistics company always follows the same planDelivery() routine: pack, route, dispatch. But a road branch dispatches a truck and a sea branch dispatches a ship. The "which vehicle?" step is the factory method, and each branch fills it in its own way.',
  whenToUse: [
    "A class cannot know ahead of time which concrete class of object it will need to create.",
    "You want specialized creators to choose the objects they create, without changing shared planning code.",
    "You want product selection to live behind one factory method rather than in the client.",
  ],
  pros: [
    "The creator is not tightly coupled to concrete product classes.",
    "Single Responsibility: the code that creates products lives in one place.",
    "Open/Closed: add a product by providing another creator implementation without changing the shared planning code.",
  ],
  cons: [
    "Class-based versions may need a new creator subclass for every product variant; Go can add another interface implementation instead.",
    "It adds a layer of indirection, which is overkill if there will only ever be one product type.",
  ],
  realWorld: [
    "The GoF book's own example: an Application base class whose subclasses override CreateDocument() to return their own kind of Document",
    "java.util.Collection.iterator(): each concrete collection overrides it to return its own Iterator",
    "A Dialog base class whose subclasses override createButton() to return a platform-specific button",
  ],
  related: ["abstract-factory", "prototype", "builder", "template-method"],
  participants: [
    {
      id: "transport",
      label: "Transport",
      role: "Product interface",
      kind: "interface",
      x: 620,
      y: 90,
      description:
        "Declares deliver(), the operation every concrete vehicle must implement.",
    },
    {
      id: "truck",
      label: "Truck",
      role: "Concrete Product",
      kind: "class",
      x: 500,
      y: 230,
      description: "Delivers cargo by road.",
    },
    {
      id: "ship",
      label: "Ship",
      role: "Concrete Product",
      kind: "class",
      x: 740,
      y: 230,
      description: "Delivers cargo by sea.",
    },
    {
      id: "logistics",
      label: "Logistics",
      role: "Creator abstraction",
      kind: "abstract",
      x: 260,
      y: 90,
      width: 180,
      description:
        "Defines the CreateTransport factory contract. Class-based tabs put shared planDelivery() on an abstract Creator; Go uses a Logistics interface and the shared PlanDelivery function.",
    },
    {
      id: "roadLogistics",
      label: "RoadLogistics",
      role: "Concrete Creator",
      kind: "class",
      x: 120,
      y: 230,
      description:
        "Supplies a Truck: by overriding createTransport() in class-based tabs or implementing CreateTransport() in Go.",
    },
    {
      id: "seaLogistics",
      label: "SeaLogistics",
      role: "Concrete Creator",
      kind: "class",
      x: 340,
      y: 340,
      description:
        "Supplies a Ship: by overriding createTransport() in class-based tabs or implementing CreateTransport() in Go.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 120,
      y: 400,
      description:
        "Works against the creator abstraction — class-based tabs call planDelivery(), while Go passes a Logistics to PlanDelivery(); neither client depends on the concrete Transport.",
    },
  ],
  relations: [
    {
      id: "road-extends",
      from: "roadLogistics",
      to: "logistics",
      type: "implements",
      description:
        "RoadLogistics subclasses the Creator in class-based tabs and implements Logistics in Go, supplying a Truck from the factory method.",
    },
    {
      id: "sea-extends",
      from: "seaLogistics",
      to: "logistics",
      type: "implements",
      description:
        "SeaLogistics subclasses the Creator in class-based tabs and implements Logistics in Go, supplying a Ship from the factory method.",
    },
    {
      id: "truck-impl",
      from: "truck",
      to: "transport",
      type: "implements",
      description: "Truck implements the Transport interface.",
    },
    {
      id: "ship-impl",
      from: "ship",
      to: "transport",
      type: "implements",
      description: "Ship implements the Transport interface.",
    },
    {
      id: "road-creates",
      from: "roadLogistics",
      to: "truck",
      type: "creates",
      label: "createTransport()",
      description: "RoadLogistics.createTransport() returns a new Truck.",
      code: "roadLogistics",
    },
    {
      id: "sea-creates",
      from: "seaLogistics",
      to: "ship",
      type: "creates",
      label: "createTransport()",
      description: "SeaLogistics.createTransport() returns a new Ship.",
      code: "seaLogistics",
    },
    {
      id: "client-calls",
      from: "client",
      to: "logistics",
      type: "calls",
      label: "planDelivery()",
      description:
        "The client invokes shared delivery planning with a creator: an object method in class-based tabs or the PlanDelivery function in Go.",
      bend: -40,
      code: "usage",
    },
    {
      id: "logistics-delivers",
      from: "logistics",
      to: "transport",
      type: "calls",
      label: "deliver()",
      description:
        "planDelivery() calls deliver() on the Transport it got back from createTransport(), through the interface only.",
      code: "logistics",
    },
  ],
  steps: [
    {
      title: "Shared algorithm, factory step",
      description:
        "Class-based tabs share Logistics.planDelivery() and leave createTransport() abstract. Go keeps the shared algorithm in PlanDelivery(l Logistics), which calls the interface method CreateTransport().",
      highlight: ["logistics"],
      code: "logistics",
    },
    {
      title: "Client picks a concrete creator",
      description:
        "The client supplies a RoadLogistics creator to shared planning: a planDelivery() call in class-based tabs or PlanDelivery(logistics) in Go.",
      highlight: ["client", "client-calls"],
      packets: [{ relation: "client-calls", label: "planDelivery()" }],
      code: "usage",
    },
    {
      title: "Factory method runs",
      description:
        "Shared planning calls the creator’s factory method: dynamic dispatch selects RoadLogistics’s override in class-based tabs, while Go calls RoadLogistics.CreateTransport() through Logistics.",
      highlight: ["roadLogistics", "road-creates", "truck"],
      packets: [{ relation: "road-creates", label: "new Truck()" }],
      notes: { truck: "created" },
      code: "roadLogistics",
    },
    {
      title: "Deliver, polymorphically",
      description:
        "planDelivery() calls deliver() on the Transport it got back, without ever knowing it is a Truck.",
      highlight: ["logistics", "transport", "truck", "logistics-delivers"],
      packets: [{ relation: "logistics-delivers", label: "deliver()" }],
      notes: { truck: "deliver() ran" },
      code: "logistics",
    },
    {
      title: "Swap the creator, not the algorithm",
      description:
        "Using SeaLogistics instead produces a Ship and sails it — the shared planning algorithm stays unchanged in every tab.",
      highlight: ["seaLogistics", "sea-creates", "ship"],
      packets: [{ relation: "sea-creates", label: "new Ship()" }],
      notes: { ship: "created" },
      code: "seaLogistics",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
