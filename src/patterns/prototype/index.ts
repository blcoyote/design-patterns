import type { PatternDefinition } from '@/types/pattern'

export const pattern: PatternDefinition = {
  slug: 'prototype',
  name: 'Prototype',
  category: 'creational',
  order: 5,
  summary: 'Copy existing objects to create new ones, instead of building them from scratch.',
  intent:
    'Specify the kinds of objects to create using a prototypical instance, and create new objects by copying that prototype rather than instantiating a class directly.',
  problem:
    'Creating a new object sometimes means reproducing an expensive or elaborate setup — a fully configured Circle with a chain of style settings, or a Document with its layout already computed. Re-running that setup through a constructor every time is wasteful, and it forces the caller to know the exact concrete class and every constructor argument, coupling it to a class hierarchy it should not need to care about.',
  solution:
    'Give every object a clone() method that knows how to copy itself, including any nested objects it owns. To create a new object, ask an existing instance — a prototype — to clone itself instead of calling `new ConcreteClass(...)`. A small PrototypeRegistry can keep a named set of ready-made prototypes so client code can copy by name, like clone("circle"), without ever importing the Circle class.',
  analogy:
    'A biological cell is not assembled from a blueprint each time one is needed — an existing cell splits and copies itself, nucleus and all. Asking a cell to divide is faster and safer than building a new one from scratch, and each offspring is independent of its parent afterward.',
  whenToUse: [
    'Creating an object is costly or elaborate, and an already-configured instance exists that is close to what you need.',
    'You want to avoid a factory class hierarchy that parallels the product hierarchy.',
    'The concrete class of the object being copied should stay hidden from the client, which should depend only on a common clone() operation.',
    'You need many near-identical objects that differ from each other only by small tweaks made after copying.',
  ],
  pros: [
    'Creates new objects without coupling the client to their concrete classes.',
    'Avoids repeating expensive or complex initialization — the prototype already did it once.',
    'New kinds of objects can be introduced at runtime by registering an instance, not by adding a class.',
    'Produces pre-configured variants of an object (a "preset") simply by cloning and tweaking.',
  ],
  cons: [
    'Cloning objects with circular references or deeply nested structures can be tricky to get right.',
    'Deep vs. shallow copy must be decided per class — getting it wrong causes subtle shared-state bugs between the original and its clones.',
    'Classes that wrap non-cloneable resources, like open sockets or file handles, need special-case handling.',
  ],
  realWorld: [
    'Object.create(proto) and structuredClone() in JavaScript',
    'java.lang.Object.clone() and the Cloneable marker interface',
    'Editor "duplicate" commands that copy a fully configured shape, layer or component',
    'Immer/Redux-style state updates that clone-then-modify a draft instead of mutating state in place',
  ],
  related: ['factory-method', 'abstract-factory', 'builder', 'composite'],

  participants: [
    {
      id: 'prototype',
      label: 'Shape',
      role: 'Prototype interface',
      kind: 'interface',
      x: 400,
      y: 60,
      description: 'Declares the single clone(): Shape operation every concrete prototype must implement. Everyone else depends only on this.',
    },
    {
      id: 'circle',
      label: 'Circle',
      role: 'Concrete Prototype',
      kind: 'class',
      x: 180,
      y: 220,
      description: 'Stores a radius and a nested Style object. clone() must copy both the instance and the Style it owns, not just alias it.',
    },
    {
      id: 'rectangle',
      label: 'Rectangle',
      role: 'Concrete Prototype',
      kind: 'class',
      x: 180,
      y: 370,
      description: 'A second concrete prototype. Its clone() returns a Rectangle without the caller ever naming the Rectangle class.',
    },
    {
      id: 'registry',
      label: 'ShapeRegistry',
      role: 'Prototype Registry',
      kind: 'class',
      x: 470,
      y: 290,
      width: 180,
      description: 'Keeps a named map of ready-made prototype instances and hands out copies by key, so clients never call a constructor directly.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 660,
      y: 150,
      description: 'Asks the registry for a clone by name, then customizes only the fields it cares about — it never imports Circle or Rectangle.',
      code: 'usage',
    },
  ],

  relations: [
    { id: 'circle-impl', from: 'circle', to: 'prototype', type: 'implements', description: 'Circle implements Shape, so it can be cloned through the same interface as any other shape.' },
    { id: 'rectangle-impl', from: 'rectangle', to: 'prototype', type: 'implements', description: 'Rectangle implements Shape too — the registry never needs to special-case it.', bend: -20 },
    {
      id: 'registry-holds',
      from: 'registry',
      to: 'prototype',
      type: 'holds',
      label: 'prototypes: Map',
      description: 'The registry stores its prototypes typed only as Shape, keyed by name — it does not know or care which concrete class each one is.',
      bend: 30,
      code: 'holds',
    },
    {
      id: 'client-request',
      from: 'client',
      to: 'registry',
      type: 'calls',
      label: 'clone("circle")',
      description: 'The client asks the registry for a copy by key. It never writes `new Circle(...)` itself.',
      code: 'usage',
    },
    {
      id: 'registry-clone-circle',
      from: 'registry',
      to: 'circle',
      type: 'calls',
      label: 'prototype.clone()',
      description: 'The registry looks up the stored Circle instance and calls its clone() method — it delegates the copy, rather than constructing one itself.',
      code: 'circleClone',
    },
    {
      id: 'registry-clone-rectangle',
      from: 'registry',
      to: 'rectangle',
      type: 'calls',
      label: 'prototype.clone()',
      description: 'The same lookup-and-delegate path works for the Rectangle prototype, with no change to the registry code.',
      code: 'rectangleClone',
    },
  ],

  steps: [
    {
      title: 'Registry seeded with prototypes',
      description: 'A ShapeRegistry is built and pre-loaded with one fully-configured Circle and one Rectangle, each registered under a name.',
      highlight: ['registry', 'registry-holds', 'circle', 'rectangle'],
      notes: { registry: 'prototypes: 2' },
      code: 'seed',
    },
    {
      title: 'Client asks for a clone',
      description: 'The client calls registry.clone("circle"). It names a key, not a class — Circle is never imported by client code.',
      highlight: ['client', 'client-request', 'registry'],
      packets: [{ relation: 'client-request', label: 'clone("circle")' }],
      code: 'usage',
    },
    {
      title: 'Registry delegates to the stored instance',
      description: 'Inside clone(), the registry looks up the prototype by key and calls prototype.clone() on it — it never calls `new Circle()` itself.',
      highlight: ['registry', 'registry-clone-circle', 'circle'],
      packets: [{ relation: 'registry-clone-circle', label: 'prototype.clone()' }],
      code: 'registryClone',
    },
    {
      title: 'Deep clone protects nested state',
      description: 'Circle.clone() copies its radius directly, but asks its Style object to clone itself too, so the new Circle gets its own Style rather than a shared reference.',
      highlight: ['circle'],
      notes: { circle: 'style cloned' },
      code: 'circleClone',
    },
    {
      title: 'The copy travels back',
      description: 'The cloned Circle returns from prototype.clone() to the registry, and from the registry back to the client, fully formed.',
      highlight: ['registry-clone-circle', 'client-request'],
      packets: [
        { relation: 'registry-clone-circle', label: 'Circle', reverse: true },
        { relation: 'client-request', label: 'Circle', reverse: true },
      ],
      code: 'registryClone',
    },
    {
      title: 'Customize without touching the original',
      description: 'The client changes the clone\'s radius and style color. Because the Style was deep-copied, the registered prototype keeps its original values untouched.',
      highlight: ['client', 'circle'],
      notes: { circle: 'prototype unchanged' },
      code: 'usage',
    },
    {
      title: 'Same registry, different concrete type',
      description: 'The client calls clone("rectangle") through the exact same method it just used for the circle — the registry API never changes per type.',
      highlight: ['client', 'client-request', 'registry'],
      packets: [{ relation: 'client-request', label: 'clone("rectangle")' }],
      code: 'usage',
    },
    {
      title: 'Rectangle clones itself too',
      description: 'The registry delegates to the stored Rectangle exactly as it did for the Circle: look up, then call clone() on whatever is found.',
      highlight: ['registry', 'registry-clone-rectangle', 'rectangle'],
      packets: [{ relation: 'registry-clone-rectangle', label: 'prototype.clone()' }],
      notes: { rectangle: 'clone created' },
      code: 'rectangleClone',
    },
    {
      title: 'New types need no new classes',
      description: 'Adding a third shape later means registering one more instance in the registry — no new Creator subclass, no change to client code.',
      highlight: ['prototype', 'registry', 'circle', 'rectangle'],
      code: 'registry',
    },
  ],

  code: `
// [style]
class Style {
  constructor(public color: string, public lineWidth: number) {}

  clone(): Style {
    return new Style(this.color, this.lineWidth)
  }
}
// [/style]

// [prototype]
interface Shape {
  clone(): Shape
}
// [/prototype]

// [circle]
class Circle implements Shape {
  constructor(public radius: number, public style: Style) {}

  // [circleClone]
  clone(): Circle {
    // Deep copy: a fresh Style, not a shared reference to the original's.
    return new Circle(this.radius, this.style.clone())
  }
  // [/circleClone]
}
// [/circle]

// [rectangle]
class Rectangle implements Shape {
  constructor(public width: number, public height: number, public style: Style) {}

  // [rectangleClone]
  clone(): Rectangle {
    return new Rectangle(this.width, this.height, this.style.clone())
  }
  // [/rectangleClone]
}
// [/rectangle]

// [registry]
class ShapeRegistry {
  // [holds]
  private prototypes = new Map<string, Shape>()
  // [/holds]

  // [seed]
  register(key: string, prototype: Shape) {
    this.prototypes.set(key, prototype)
  }
  // [/seed]

  // [registryClone]
  clone(key: string): Shape {
    const prototype = this.prototypes.get(key)
    if (!prototype) throw new Error(\`Unknown prototype: \${key}\`)
    return prototype.clone()
  }
  // [/registryClone]
}
// [/registry]

// Usage
// [usage]
const registry = new ShapeRegistry()
registry.register('circle', new Circle(5, new Style('black', 1)))
registry.register('rectangle', new Rectangle(10, 20, new Style('blue', 2)))

const myCircle = registry.clone('circle') as Circle
myCircle.radius = 50
myCircle.style.color = 'red' // safe: myCircle.style is its own copy

const myRect = registry.clone('rectangle') as Rectangle
myRect.width = 100
// [/usage]
`,
}
