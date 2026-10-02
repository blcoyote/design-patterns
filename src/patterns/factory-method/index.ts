import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'factory-method',
  name: 'Factory Method',
  category: 'creational',
  order: 2,
  summary: 'Let subclasses decide which concrete class to instantiate.',
  intent:
    'Define an interface for creating an object, but let subclasses decide which class to instantiate. Factory Method lets a class defer instantiation to subclasses.',
  problem:
    'A LogisticsCo base class plans deliveries, but the concrete vehicle used — truck, ship, plane — depends on which kind of logistics company you are. If the base class hard-codes `new Truck()`, you cannot extend it to sea or air logistics without rewriting its planning logic.',
  solution:
    'Pull the object-creation step out into its own method — createTransport() — and make it abstract. Each subclass (RoadLogistics, SeaLogistics) overrides createTransport() to return the Transport it needs. The shared planning logic in the base class calls createTransport() without knowing which concrete class comes back.',
  analogy:
    'A logistics company always has a planDelivery() process — pack, route, dispatch — but a road branch dispatches a truck and a sea branch dispatches a ship. The dispatching step is a "factory method" each branch implements its own way.',
  whenToUse: [
    'A class cannot anticipate the exact class of objects it must create ahead of time.',
    'You want to let subclasses specify the objects they create, without changing shared code.',
    'You want to centralize the knowledge of which concrete class to instantiate, instead of scattering `new SomeClass()` everywhere.',
  ],
  pros: [
    'Avoids tight coupling between the creator class and concrete product classes.',
    'Single Responsibility: product-creation code lives in one place.',
    'Open/Closed: introduce new product types by adding a new creator subclass, with no changes to existing code.',
  ],
  cons: [
    'Can require a new subclass per product variant, growing the class hierarchy.',
    'Adds a layer of indirection that is overkill if there is only ever one product type.',
  ],
  realWorld: [
    'Document.createPage() in editors that support multiple page/document types',
    'java.util.Calendar.getInstance() returns a locale-specific subclass',
    'UI toolkit Button factories that return platform-specific buttons (Windows, macOS, Web)',
    'Framework "create" hooks that let app code supply its own object type (e.g. a custom HttpClient)',
  ],
  related: ['builder', 'singleton', 'strategy'],
  participants: [
    {
      id: 'transport',
      label: 'Transport',
      role: 'Product interface',
      kind: 'interface',
      x: 620,
      y: 90,
      description: 'Declares deliver(), the operation every concrete vehicle must implement.',
    },
    {
      id: 'truck',
      label: 'Truck',
      role: 'Concrete Product',
      kind: 'class',
      x: 500,
      y: 230,
      description: 'Delivers cargo by road.',
    },
    {
      id: 'ship',
      label: 'Ship',
      role: 'Concrete Product',
      kind: 'class',
      x: 740,
      y: 230,
      description: 'Delivers cargo by sea.',
    },
    {
      id: 'logistics',
      label: 'Logistics',
      role: 'Creator (abstract)',
      kind: 'abstract',
      x: 260,
      y: 90,
      width: 180,
      description: 'Declares the abstract createTransport() factory method and a shared planDelivery() that uses it, without knowing which Transport it gets back.',
    },
    {
      id: 'roadLogistics',
      label: 'RoadLogistics',
      role: 'Concrete Creator',
      kind: 'class',
      x: 120,
      y: 230,
      description: 'Overrides createTransport() to return a new Truck.',
    },
    {
      id: 'seaLogistics',
      label: 'SeaLogistics',
      role: 'Concrete Creator',
      kind: 'class',
      x: 340,
      y: 340,
      description: 'Overrides createTransport() to return a new Ship.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 120,
      y: 400,
      description: 'Works only against the abstract Logistics type — it calls planDelivery() without knowing or caring which Transport subclass is used underneath.',
    },
  ],
  relations: [
    { id: 'road-extends', from: 'roadLogistics', to: 'logistics', type: 'implements', description: 'RoadLogistics extends Logistics and overrides createTransport().' },
    { id: 'sea-extends', from: 'seaLogistics', to: 'logistics', type: 'implements', description: 'SeaLogistics extends Logistics and overrides createTransport().' },
    { id: 'truck-impl', from: 'truck', to: 'transport', type: 'implements', description: 'Truck implements the Transport interface.' },
    { id: 'ship-impl', from: 'ship', to: 'transport', type: 'implements', description: 'Ship implements the Transport interface.' },
    {
      id: 'road-creates',
      from: 'roadLogistics',
      to: 'truck',
      type: 'creates',
      label: 'createTransport()',
      description: 'RoadLogistics.createTransport() returns a new Truck.',
      code: 'roadLogistics',
    },
    {
      id: 'sea-creates',
      from: 'seaLogistics',
      to: 'ship',
      type: 'creates',
      label: 'createTransport()',
      description: 'SeaLogistics.createTransport() returns a new Ship.',
      code: 'seaLogistics',
    },
    {
      id: 'client-calls',
      from: 'client',
      to: 'logistics',
      type: 'calls',
      label: 'planDelivery()',
      description: 'The client only ever calls planDelivery() on whichever Logistics subclass it was given.',
      bend: -40,
      code: 'usage',
    },
  ],
  steps: [
    {
      title: 'Shared algorithm, abstract step',
      description: 'Logistics.planDelivery() is fully implemented and shared by every subclass — except for one step, createTransport(), which is left abstract.',
      highlight: ['logistics'],
      code: 'logistics',
    },
    {
      title: 'Client picks a concrete creator',
      description: 'The client instantiates a RoadLogistics and calls planDelivery() on it, through the abstract Logistics type.',
      highlight: ['client', 'client-calls'],
      packets: [{ relation: 'client-calls', label: 'planDelivery()' }],
      code: 'usage',
    },
    {
      title: 'Factory method runs',
      description: 'Inside planDelivery(), the call to this.createTransport() resolves to RoadLogistics’s override, which builds a Truck.',
      highlight: ['roadLogistics', 'road-creates', 'truck'],
      packets: [{ relation: 'road-creates', label: 'new Truck()' }],
      notes: { truck: 'created' },
      code: 'roadLogistics',
    },
    {
      title: 'Deliver, polymorphically',
      description: 'planDelivery() calls deliver() on the Transport it got back, without ever knowing it is a Truck.',
      highlight: ['logistics', 'transport', 'truck'],
      notes: { truck: 'deliver() ran' },
      code: 'logistics',
    },
    {
      title: 'Swap the creator, not the algorithm',
      description: 'Using SeaLogistics instead produces a Ship and sails it — planDelivery() itself never changes.',
      highlight: ['seaLogistics', 'sea-creates', 'ship'],
      packets: [{ relation: 'sea-creates', label: 'new Ship()' }],
      notes: { ship: 'created' },
      code: 'seaLogistics',
    },
  ],
  code: `
// [transport]
interface Transport {
  deliver(): string
}
// [/transport]

// [truck]
class Truck implements Transport {
  deliver(): string {
    return 'Delivering by road in a truck'
  }
}
// [/truck]

// [ship]
class Ship implements Transport {
  deliver(): string {
    return 'Delivering by sea in a ship'
  }
}
// [/ship]

// [logistics]
abstract class Logistics {
  // The factory method — subclasses decide what this returns.
  abstract createTransport(): Transport

  // Shared logic that relies on createTransport() without knowing the concrete type.
  planDelivery(): string {
    const transport = this.createTransport()
    return \`Planned. \${transport.deliver()}\`
  }
}
// [/logistics]

// [roadLogistics]
class RoadLogistics extends Logistics {
  createTransport(): Transport {
    return new Truck()
  }
}
// [/roadLogistics]

// [seaLogistics]
class SeaLogistics extends Logistics {
  createTransport(): Transport {
    return new Ship()
  }
}
// [/seaLogistics]

// Usage
// [usage]
function runDelivery(logistics: Logistics) {
  console.log(logistics.planDelivery())
}

runDelivery(new RoadLogistics()) // "Planned. Delivering by road in a truck"
runDelivery(new SeaLogistics()) // "Planned. Delivering by sea in a ship"
// [/usage]
`,
}
