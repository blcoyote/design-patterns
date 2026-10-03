import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { FlyweightVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "flyweight",
  name: "Flyweight",
  category: "structural",
  order: 7,
  summary: "Share common state across many objects to keep large numbers of them cheap.",
  intent:
    "Save memory by sharing the common parts of many similar objects instead of storing a copy in each one.",
  problem:
    "A map editor needs to draw a forest of thousands of trees, or a text editor needs an object for every character on the page. If every Tree or Glyph stores its own copy of the species texture or the font outline, memory use explodes. Most of that data is identical across instances, and only the position, age or scale really differs.",
  solution:
    "Split each object's state into intrinsic state (shared and independent of context, like the texture or font outline) and extrinsic state (unique to each instance, like position, age or scale). Move the intrinsic state into a small set of shared Flyweight objects, handed out by a factory that caches them by key. The many lightweight context objects keep only the extrinsic state. Every object that needs a given combination of shared data reuses the same flyweight instance.",
  analogy:
    'A print shop keeps one metal stamp per letter and reuses it everywhere that letter appears on the page. It does not cast a brand-new stamp for every single "e".',
  whenToUse: [
    "Your application creates a huge number of similar objects, and they strain memory.",
    "Most of an object's state can be made extrinsic, meaning it is passed in rather than stored.",
    "Objects can be grouped by a small set of shared, immutable properties.",
    "Object identity does not matter to callers. They only care that the shared state is correct, not whether two references point at the same instance.",
  ],
  pros: [
    "It sharply reduces memory use when many objects share the same underlying data.",
    "Intrinsic state is built and validated only once per variant.",
    "Not the same as an object pool: a pool lends out exclusive, mutable objects that the borrower can change and must return, while flyweights are shared, immutable, and never owned by any one caller.",
  ],
  cons: [
    "It adds complexity: you must split state into intrinsic and extrinsic, and pass the extrinsic data through method calls.",
    "Recomputing or passing extrinsic state on every call can trade memory for extra CPU work.",
    "It only pays off once the instance count is large enough to matter. Used too early, it is just indirection.",
  ],
  realWorld: [
    "Glyph rendering in text editors and browsers, where one font-glyph object is reused for every occurrence of a character",
    "Game engines and map renderers that reuse a handful of mesh or texture objects across thousands of trees, rocks or units",
    "String interning: Java string literals and String.intern(), or Python's sys.intern(), share one underlying instance for equal strings",
  ],
  related: ["object-pool", "proxy", "composite", "factory-method"],

  participants: [
    {
      id: "forest",
      label: "Forest",
      role: "Client",
      kind: "client",
      x: 130,
      y: 230,
      description:
        "Plants trees by asking the factory for a shared TreeType, then builds a Tree that pairs that shared reference with its own position and age.",
    },
    {
      id: "tree",
      label: "Tree",
      role: "Context (unshared)",
      kind: "class",
      x: 370,
      y: 350,
      description:
        "Holds only extrinsic state — x, y, age — plus a reference to a shared TreeType. Thousands of these can exist cheaply.",
    },
    {
      id: "factory",
      label: "TreeTypeFactory",
      role: "Flyweight Factory",
      kind: "class",
      x: 370,
      y: 110,
      width: 200,
      description:
        "Caches ConcreteTreeType instances by key (name + color + texture). Returns the cached instance on a hit, builds one on a miss.",
    },
    {
      id: "treeType",
      label: "TreeType",
      role: "Flyweight interface",
      kind: "interface",
      x: 660,
      y: 110,
      description:
        "Declares draw(canvas, x, y, age) — the one method both Forest and Tree depend on, never the concrete class.",
    },
    {
      id: "concreteType",
      label: "ConcreteTreeType",
      role: "Concrete Flyweight",
      kind: "class",
      x: 660,
      y: 230,
      width: 200,
      description:
        "Stores intrinsic state — species name, color, texture — exactly once per variant, no matter how many trees reference it.",
    },
    {
      id: "canvas",
      label: "Canvas",
      role: "Render target",
      kind: "object",
      x: 660,
      y: 350,
      description:
        "Receives paint calls carrying both the flyweight's intrinsic look and the extrinsic coordinates passed in.",
    },
  ],

  relations: [
    {
      id: "request-type",
      from: "forest",
      to: "factory",
      type: "calls",
      label: "getTreeType(name,color,texture)",
      description:
        "Before planting, Forest asks the factory for the TreeType matching this exact name:color:texture key — it never constructs one directly.",
      bend: -20,
      code: "getTreeType",
    },
    {
      id: "factory-create",
      from: "factory",
      to: "concreteType",
      type: "creates",
      label: "new ConcreteTreeType()",
      description:
        "On a cache miss, the factory builds exactly one ConcreteTreeType for this key and stores it in its pool before returning it.",
      bend: 20,
      code: "getTreeType",
    },
    {
      id: "concrete-implements",
      from: "concreteType",
      to: "treeType",
      type: "implements",
      description:
        "ConcreteTreeType implements the TreeType interface — Forest and Tree only ever see it through that interface.",
      code: "concreteType",
    },
    {
      id: "plant-tree",
      from: "forest",
      to: "tree",
      type: "creates",
      label: "new Tree(x,y,age,type)",
      description:
        "Forest constructs a Tree, handing it its own position and age plus the shared TreeType reference it just obtained.",
      code: "plant",
    },
    {
      id: "tree-holds",
      from: "tree",
      to: "treeType",
      type: "holds",
      label: "type",
      description:
        "Each Tree stores only a reference typed as TreeType — never a private copy of its species data, and never a reference typed to the concrete class.",
      bend: -25,
      code: "holds",
    },
    {
      id: "tree-draw",
      from: "tree",
      to: "treeType",
      type: "calls",
      label: "draw(canvas,x,y,age)",
      description:
        "When rendering, Tree forwards its own (x, y, age) to the shared flyweight instead of drawing itself.",
      bend: 25,
      code: "treeDraw",
    },
    {
      id: "type-paint",
      from: "concreteType",
      to: "canvas",
      type: "calls",
      label: "paintTree()",
      description:
        "The flyweight paints onto the canvas using its intrinsic color and texture plus the extrinsic coordinates it was just given.",
      code: "draw",
    },
  ],

  steps: [
    {
      title: "An empty forest",
      description:
        "Forest starts empty, and the TreeTypeFactory pool has not cached anything yet — no ConcreteTreeType objects exist.",
      highlight: ["forest", "factory"],
      notes: { factory: "pool: 0 types" },
      code: "forest",
    },
    {
      title: "Ask for an Oak type",
      description:
        'Planting the first tree starts with a request: Forest asks the factory for the TreeType matching the key "Oak:#2f6b3a:rough-bark.png" (name, color and texture together). The pool is empty, so this will be a cache miss.',
      highlight: ["request-type"],
      packets: [
        {
          relation: "request-type",
          label: 'getTreeType("Oak", "#2f6b3a", "rough-bark.png")',
        },
      ],
      notes: { factory: "pool: 0 types" },
      code: "getTreeType",
    },
    {
      title: "Factory builds the flyweight",
      description:
        'On the cache miss, the factory constructs one ConcreteTreeType holding the Oak color and texture, caches it under the key "Oak:#2f6b3a:rough-bark.png", and hands it back.',
      highlight: ["factory-create", "concrete-implements"],
      packets: [{ relation: "request-type", label: "OakType", reverse: true }],
      notes: { factory: "pool: 1 type", concreteType: "Oak (new)" },
      code: "getTreeType",
    },
    {
      title: "Tree #1 stores only a reference",
      description:
        "Forest creates a Tree at (120, 40) with age 3, passing in the shared OakType. The tree keeps its own position and age but no species data of its own.",
      highlight: ["plant-tree", "tree-holds"],
      packets: [{ relation: "plant-tree", label: "new Tree(120,40,3,oakType)" }],
      notes: { tree: "x:120 y:40", factory: "pool: 1 type" },
      code: "plant",
    },
    {
      title: "A second Oak — no new object",
      description:
        'Another Oak is planted elsewhere in the forest. The factory looks up the same "Oak:#2f6b3a:rough-bark.png" key again, finds OakType already cached, and returns that exact same instance.',
      highlight: ["request-type", "plant-tree"],
      packets: [
        {
          relation: "request-type",
          label: 'getTreeType("Oak", "#2f6b3a", "rough-bark.png")',
        },
        {
          relation: "request-type",
          label: "OakType (cached)",
          reverse: true,
          after: 0,
        },
      ],
      notes: { factory: "pool: 1 type", tree: "x:340 y:95" },
      code: "getTreeType",
    },
    {
      title: "A new species: Pine",
      description:
        'The key "Pine:#1f4d2e:needle-bark.png" has not been requested before, so this lookup misses the cache too. The factory builds a second ConcreteTreeType and adds it to the pool.',
      highlight: ["request-type", "factory-create"],
      notes: { factory: "pool: 2 types" },
      code: "getTreeType",
    },
    {
      title: "Scaling to thousands of trees",
      description:
        "Forest keeps planting — thousands of Oaks and Pines, each a cheap Tree holding just x, y and age. Every one of them points at one of the same two cached TreeType objects.",
      highlight: ["plant-tree", "tree-holds"],
      notes: { factory: "pool: 2 types", tree: "instances: 5,000+" },
      code: "plant",
    },
    {
      title: "Rendering, and the memory saved",
      description:
        "To draw a frame, each Tree.render() calls draw() on its shared TreeType with its own (x, y, age); the flyweight paints using its intrinsic color and texture. Two shared objects now back thousands of trees.",
      highlight: ["tree-draw", "type-paint"],
      packets: [
        { relation: "tree-draw", label: "draw(canvas,x,y,age)" },
        { relation: "type-paint", label: "paintTree()", after: 0 },
      ],
      notes: {
        factory: "pool: 2 types",
        concreteType: "shared by 5,000+ trees",
      },
      code: "treeDraw",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: FlyweightVisualization,
};
