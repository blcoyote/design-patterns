import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from './example.go?raw'

export const pattern: PatternDefinition = {
  slug: "prototype",
  name: "Prototype",
  category: "creational",
  order: 5,
  summary:
    "Copy existing objects to create new ones, instead of building them from scratch.",
  intent:
    'Create new objects by copying an existing one instead of building each from scratch.',
  problem:
    "Sometimes creating an object means repeating an expensive or elaborate setup, like a Circle with a long list of style settings or a Document whose layout is already computed. Running that setup through a constructor every time is wasteful. It also forces the caller to know the exact concrete class and every constructor argument, which ties it to a class hierarchy it should not have to care about.",
  solution:
    'Give every object a clone() method that knows how to copy itself, including any nested objects it owns. To make a new object, ask an existing instance (the prototype) to clone itself instead of calling `new ConcreteClass(...)`. A small PrototypeRegistry can hold a named set of ready-made prototypes. Client code then copies by name, like clone("circle"), without ever importing the Circle class.',
  analogy:
    "A biological cell does not follow a blueprint each time a new one is needed. An existing cell splits and copies itself, nucleus and all. Copying what already exists is faster than building from scratch, and once the copy exists it lives independently of its parent.",
  whenToUse: [
    "Creating an object is costly or elaborate, and you already have a configured instance that is close to what you need.",
    "You want to avoid a factory class hierarchy that mirrors the product hierarchy.",
    "The concrete class being copied should stay hidden from the client, which depends only on a common clone() operation.",
    "You need many near-identical objects that differ only by small tweaks made after copying.",
  ],
  pros: [
    "You create new objects without coupling the client to their concrete classes.",
    "You skip repeating expensive or complex setup, because the prototype already did it once.",
    "You can add new kinds of objects at runtime by registering an instance, instead of writing a new class.",
    'You get ready-made variants (a "preset") by cloning and tweaking.',
  ],
  cons: [
    "Cloning objects with circular references or deeply nested structures can be tricky to get right.",
    "Each class must decide between a deep and a shallow copy. Getting it wrong causes subtle bugs where the original and its clones share state.",
    "Classes that wrap resources that cannot be copied, like open sockets or file handles, need special handling.",
  ],
  realWorld: [
    "structuredClone() in JavaScript for deep copies, or `{ ...obj }` / Object.assign() for a shallow copy",
    "java.lang.Object.clone() and the Cloneable marker interface",
    'Editor "duplicate" commands that copy a fully configured shape, layer or component',
  ],
  related: ["factory-method", "abstract-factory", "builder", "composite"],

  participants: [
    {
      id: "prototype",
      label: "Shape",
      role: "Prototype interface",
      kind: "interface",
      x: 400,
      y: 60,
      description:
        "Declares the single clone(): Shape operation every concrete prototype must implement. Everyone else depends only on this.",
    },
    {
      id: "circle",
      label: "Circle",
      role: "Concrete Prototype",
      kind: "class",
      x: 180,
      y: 220,
      description:
        "Stores a radius and a nested Style object. clone() must copy both the instance and the Style it owns, not just alias it.",
    },
    {
      id: "rectangle",
      label: "Rectangle",
      role: "Concrete Prototype",
      kind: "class",
      x: 180,
      y: 370,
      description:
        "A second concrete prototype. Its clone() returns a Rectangle without the caller ever naming the Rectangle class.",
    },
    {
      id: "registry",
      label: "ShapeRegistry",
      role: "Prototype Registry",
      kind: "class",
      x: 470,
      y: 290,
      width: 180,
      description:
        "Keeps a named map of ready-made prototype instances and hands out copies by key, so clients never call a constructor directly.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 660,
      y: 150,
      description:
        "Asks the registry for a clone by name, then customizes the Style every shape shares through the Shape interface — only a shape-specific tweak needs a cast to the concrete type.",
      code: "usage",
    },
  ],

  relations: [
    {
      id: "circle-impl",
      from: "circle",
      to: "prototype",
      type: "implements",
      description:
        "Circle implements Shape, so it can be cloned through the same interface as any other shape.",
    },
    {
      id: "rectangle-impl",
      from: "rectangle",
      to: "prototype",
      type: "implements",
      description:
        "Rectangle implements Shape too — the registry never needs to special-case it.",
      bend: -20,
    },
    {
      id: "registry-holds",
      from: "registry",
      to: "prototype",
      type: "holds",
      label: "prototypes: Map",
      description:
        "The registry stores its prototypes typed only as Shape, keyed by name — it does not know or care which concrete class each one is.",
      bend: 30,
      code: "holds",
    },
    {
      id: "client-request",
      from: "client",
      to: "registry",
      type: "calls",
      label: 'clone("circle")',
      description:
        "The client asks the registry for a copy by key. It never writes `new Circle(...)` itself.",
      code: "usage",
    },
    {
      id: "registry-clone-circle",
      from: "registry",
      to: "circle",
      type: "calls",
      label: "prototype.clone()",
      description:
        "The registry looks up the stored Circle instance and calls its clone() method — it delegates the copy, rather than constructing one itself.",
      code: "circleClone",
    },
    {
      id: "registry-clone-rectangle",
      from: "registry",
      to: "rectangle",
      type: "calls",
      label: "prototype.clone()",
      description:
        "The same lookup-and-delegate path works for the Rectangle prototype, with no change to the registry code.",
      code: "rectangleClone",
    },
  ],

  steps: [
    {
      title: "Registry seeded with prototypes",
      description:
        "A ShapeRegistry is built and pre-loaded with one fully-configured Circle and one Rectangle, each registered under a name.",
      highlight: ["registry", "registry-holds", "circle", "rectangle"],
      notes: { registry: "prototypes: 2" },
      code: "seed",
    },
    {
      title: "Client asks for a clone",
      description:
        'The client calls registry.clone("circle"). It names a key, not a class — the registry does the construction, not the caller.',
      highlight: ["client", "client-request", "registry"],
      packets: [{ relation: "client-request", label: 'clone("circle")' }],
      code: "usage",
    },
    {
      title: "Registry delegates to the stored instance",
      description:
        "Inside clone(), the registry looks up the prototype by key and calls prototype.clone() on it — it never calls `new Circle()` itself.",
      highlight: ["registry", "registry-clone-circle", "circle"],
      packets: [
        { relation: "registry-clone-circle", label: "prototype.clone()" },
      ],
      code: "registryClone",
    },
    {
      title: "Deep clone protects nested state",
      description:
        "Circle.clone() copies its radius directly, but asks its Style object to clone itself too, so the new Circle gets its own Style rather than a shared reference.",
      highlight: ["circle"],
      notes: { circle: "style cloned" },
      code: "circleClone",
    },
    {
      title: "The copy travels back",
      description:
        "The cloned Circle returns from prototype.clone() to the registry, and from the registry back to the client, fully formed.",
      highlight: ["registry-clone-circle", "client-request"],
      packets: [
        { relation: "registry-clone-circle", label: "Circle", reverse: true },
        {
          relation: "client-request",
          label: "Circle",
          reverse: true,
          after: 0,
        },
      ],
      code: "registryClone",
    },
    {
      title: "Customize without touching the original",
      description:
        "The client changes the clone's style color through the Shape interface, and casts to Circle only to tweak its radius. Because the Style was deep-copied, the registered prototype keeps its original values untouched.",
      highlight: ["client", "circle"],
      notes: { circle: "prototype unchanged" },
      code: "usage",
    },
    {
      title: "Same registry, different concrete type",
      description:
        'The client calls clone("rectangle") through the exact same method it just used for the circle — the registry API never changes per type.',
      highlight: ["client", "client-request", "registry"],
      packets: [{ relation: "client-request", label: 'clone("rectangle")' }],
      code: "usage",
    },
    {
      title: "Rectangle clones itself too",
      description:
        "The registry delegates to the stored Rectangle exactly as it did for the Circle: look up, then call clone() on whatever is found.",
      highlight: ["registry", "registry-clone-rectangle", "rectangle"],
      packets: [
        { relation: "registry-clone-rectangle", label: "prototype.clone()" },
      ],
      notes: { rectangle: "clone created" },
      code: "rectangleClone",
    },
    {
      title: "New presets, or new types",
      description:
        "Registering one more instance in the registry adds a new preset of an existing shape. Adding a genuinely new shape type needs only that one new class implementing Shape — never a parallel Creator subclass or factory change.",
      highlight: ["prototype", "registry", "circle", "rectangle"],
      code: "registry",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
