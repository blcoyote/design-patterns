import type { PatternDefinition } from '@/types/pattern'
import { FlyweightVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'flyweight',
  name: 'Flyweight',
  category: 'structural',
  order: 7,
  summary: 'Share common state across many objects to keep large numbers of them cheap.',
  intent:
    'Use sharing to support large numbers of fine-grained objects efficiently, by factoring out the state they have in common.',
  problem:
    'A map editor needs to render a forest of thousands of trees, or a text editor needs an object per character on the page. If every Tree or every Glyph stores its own copy of the species texture or the font outline, memory use explodes — even though most of that data is identical across every instance and only the position, age or scale truly differs.',
  solution:
    'Split each object\'s state into intrinsic state (shared, context-independent — the texture, the font outline) and extrinsic state (unique per instance — position, age, scale). Move the intrinsic state into a small set of shared Flyweight objects handed out by a factory that caches them by key, and keep only the extrinsic state in the many lightweight context objects. The same flyweight instance is reused by every object that needs that particular combination of shared data.',
  analogy:
    'A print shop keeps one metal stamp per letter and reuses it everywhere that letter appears on the page, instead of casting a brand-new stamp for every single occurrence of "e".',
  whenToUse: [
    'An application needs to create a very large number of similar objects that strain memory.',
    'Most of an object\'s state can be made extrinsic — passed in rather than stored.',
    'Objects can be grouped by a small set of shared, immutable properties.',
    'Object identity does not matter to callers — they only care that the shared state is correct, not whether two references point at the exact same instance.',
  ],
  pros: [
    'Sharply reduces memory use when many objects share the same underlying data.',
    'Centralizes intrinsic state, so it is only ever built and validated once per variant.',
    'Different from an object pool: a pool lends out exclusive, mutable objects that the borrower can change and must return, while flyweights are shared, immutable, and never owned by any one caller.',
  ],
  cons: [
    'Adds complexity: state must be split into intrinsic/extrinsic, and extrinsic data threaded through method calls.',
    'Recomputing or passing extrinsic state on every call can trade memory for extra CPU work.',
    'Only pays off once the instance count is large enough to matter — used too early it is just indirection.',
  ],
  realWorld: [
    'Glyph rendering in text editors and browsers — one font-glyph object reused for every occurrence of a character.',
    'Game engines and map renderers that reuse a handful of mesh/texture objects across thousands of trees, rocks or units.',
    'String interning — Java string literals and String.intern(), or Python\'s sys.intern(), share one underlying instance for equal strings.',
    'Map libraries caching a handful of marker/icon objects reused across thousands of pins.',
  ],
  related: ['object-pool', 'proxy', 'composite', 'factory-method'],

  participants: [
    {
      id: 'forest',
      label: 'Forest',
      role: 'Client',
      kind: 'client',
      x: 130,
      y: 230,
      description:
        'Plants trees by asking the factory for a shared TreeType, then builds a Tree that pairs that shared reference with its own position and age.',
    },
    {
      id: 'tree',
      label: 'Tree',
      role: 'Context (unshared)',
      kind: 'class',
      x: 370,
      y: 350,
      description:
        'Holds only extrinsic state — x, y, age — plus a reference to a shared TreeType. Thousands of these can exist cheaply.',
    },
    {
      id: 'factory',
      label: 'TreeTypeFactory',
      role: 'Flyweight Factory',
      kind: 'class',
      x: 370,
      y: 110,
      width: 200,
      description:
        'Caches ConcreteTreeType instances by key (name + color + texture). Returns the cached instance on a hit, builds one on a miss.',
    },
    {
      id: 'treeType',
      label: 'TreeType',
      role: 'Flyweight interface',
      kind: 'interface',
      x: 660,
      y: 110,
      description: 'Declares draw(canvas, x, y, age) — the one method both Forest and Tree depend on, never the concrete class.',
    },
    {
      id: 'concreteType',
      label: 'ConcreteTreeType',
      role: 'Concrete Flyweight',
      kind: 'class',
      x: 660,
      y: 230,
      width: 200,
      description:
        'Stores intrinsic state — species name, color, texture — exactly once per variant, no matter how many trees reference it.',
    },
    {
      id: 'canvas',
      label: 'Canvas',
      role: 'Render target',
      kind: 'object',
      x: 660,
      y: 350,
      description: 'Receives paint calls carrying both the flyweight\'s intrinsic look and the extrinsic coordinates passed in.',
    },
  ],

  relations: [
    {
      id: 'request-type',
      from: 'forest',
      to: 'factory',
      type: 'calls',
      label: 'getTreeType(name,color,texture)',
      description: 'Before planting, Forest asks the factory for the TreeType matching this exact name:color:texture key — it never constructs one directly.',
      bend: -20,
      code: 'getTreeType',
    },
    {
      id: 'factory-create',
      from: 'factory',
      to: 'concreteType',
      type: 'creates',
      label: 'new ConcreteTreeType()',
      description: 'On a cache miss, the factory builds exactly one ConcreteTreeType for this key and stores it in its pool before returning it.',
      bend: 20,
      code: 'getTreeType',
    },
    {
      id: 'concrete-implements',
      from: 'concreteType',
      to: 'treeType',
      type: 'implements',
      description: 'ConcreteTreeType implements the TreeType interface — Forest and Tree only ever see it through that interface.',
      code: 'concreteType',
    },
    {
      id: 'plant-tree',
      from: 'forest',
      to: 'tree',
      type: 'creates',
      label: 'new Tree(x,y,age,type)',
      description: 'Forest constructs a Tree, handing it its own position and age plus the shared TreeType reference it just obtained.',
      code: 'plant',
    },
    {
      id: 'tree-holds',
      from: 'tree',
      to: 'treeType',
      type: 'holds',
      label: 'type',
      description: 'Each Tree stores only a reference typed as TreeType — never a private copy of its species data, and never a reference typed to the concrete class.',
      bend: -25,
      code: 'holds',
    },
    {
      id: 'tree-draw',
      from: 'tree',
      to: 'treeType',
      type: 'calls',
      label: 'draw(canvas,x,y,age)',
      description: 'When rendering, Tree forwards its own (x, y, age) to the shared flyweight instead of drawing itself.',
      bend: 25,
      code: 'treeDraw',
    },
    {
      id: 'type-paint',
      from: 'concreteType',
      to: 'canvas',
      type: 'calls',
      label: 'paintTree()',
      description: 'The flyweight paints onto the canvas using its intrinsic color and texture plus the extrinsic coordinates it was just given.',
      code: 'draw',
    },
  ],

  steps: [
    {
      title: 'An empty forest',
      description: 'Forest starts empty, and the TreeTypeFactory pool has not cached anything yet — no ConcreteTreeType objects exist.',
      highlight: ['forest', 'factory'],
      notes: { factory: 'pool: 0 types' },
      code: 'forest',
    },
    {
      title: 'Ask for an Oak type',
      description: 'Planting the first tree starts with a request: Forest asks the factory for the TreeType matching the key "Oak:#2f6b3a:rough-bark.png" (name, color and texture together). The pool is empty, so this will be a cache miss.',
      highlight: ['request-type'],
      packets: [{ relation: 'request-type', label: 'getTreeType("Oak", "#2f6b3a", "rough-bark.png")' }],
      notes: { factory: 'pool: 0 types' },
      code: 'getTreeType',
    },
    {
      title: 'Factory builds the flyweight',
      description: 'On the cache miss, the factory constructs one ConcreteTreeType holding the Oak color and texture, caches it under the key "Oak:#2f6b3a:rough-bark.png", and hands it back.',
      highlight: ['factory-create', 'concrete-implements'],
      packets: [{ relation: 'request-type', label: 'OakType', reverse: true }],
      notes: { factory: 'pool: 1 type', concreteType: 'Oak (new)' },
      code: 'getTreeType',
    },
    {
      title: 'Tree #1 stores only a reference',
      description: 'Forest creates a Tree at (120, 40) with age 3, passing in the shared OakType. The tree keeps its own position and age but no species data of its own.',
      highlight: ['plant-tree', 'tree-holds'],
      packets: [{ relation: 'plant-tree', label: 'new Tree(120,40,3,oakType)' }],
      notes: { tree: 'x:120 y:40', factory: 'pool: 1 type' },
      code: 'plant',
    },
    {
      title: 'A second Oak — no new object',
      description: 'Another Oak is planted elsewhere in the forest. The factory looks up the same "Oak:#2f6b3a:rough-bark.png" key again, finds OakType already cached, and returns that exact same instance.',
      highlight: ['request-type', 'plant-tree'],
      packets: [
        { relation: 'request-type', label: 'getTreeType("Oak", "#2f6b3a", "rough-bark.png")' },
        { relation: 'request-type', label: 'OakType (cached)', reverse: true },
      ],
      notes: { factory: 'pool: 1 type', tree: 'x:340 y:95' },
      code: 'getTreeType',
    },
    {
      title: 'A new species: Pine',
      description: 'The key "Pine:#1f4d2e:needle-bark.png" has not been requested before, so this lookup misses the cache too. The factory builds a second ConcreteTreeType and adds it to the pool.',
      highlight: ['request-type', 'factory-create'],
      notes: { factory: 'pool: 2 types' },
      code: 'getTreeType',
    },
    {
      title: 'Scaling to thousands of trees',
      description: 'Forest keeps planting — thousands of Oaks and Pines, each a cheap Tree holding just x, y and age. Every one of them points at one of the same two cached TreeType objects.',
      highlight: ['plant-tree', 'tree-holds'],
      notes: { factory: 'pool: 2 types', tree: 'instances: 5,000+' },
      code: 'plant',
    },
    {
      title: 'Rendering, and the memory saved',
      description: 'To draw a frame, each Tree.render() calls draw() on its shared TreeType with its own (x, y, age); the flyweight paints using its intrinsic color and texture. Two shared objects now back thousands of trees.',
      highlight: ['tree-draw', 'type-paint'],
      packets: [
        { relation: 'tree-draw', label: 'draw(canvas,x,y,age)' },
        { relation: 'type-paint', label: 'paintTree()' },
      ],
      notes: { factory: 'pool: 2 types', concreteType: 'shared by 5,000+ trees' },
      code: 'treeDraw',
    },
  ],

  code: `
// [canvas]
interface Canvas {
  paintTree(color: string, texture: string, x: number, y: number, age: number): void
}
// [/canvas]

// [treeType]
interface TreeType {
  draw(canvas: Canvas, x: number, y: number, age: number): void
}
// [/treeType]

// [concreteType]
class ConcreteTreeType implements TreeType {
  // Intrinsic state: shared and identical for every tree of this species.
  constructor(
    private readonly name: string,
    private readonly color: string,
    private readonly texture: string,
  ) {}

  // [draw]
  draw(canvas: Canvas, x: number, y: number, age: number): void {
    // Extrinsic state (x, y, age) arrives as arguments — it is never stored here.
    canvas.paintTree(this.color, this.texture, x, y, age)
  }
  // [/draw]
}
// [/concreteType]

// [factory]
class TreeTypeFactory {
  private readonly pool = new Map<string, ConcreteTreeType>()

  // [getTreeType]
  getTreeType(name: string, color: string, texture: string): TreeType {
    const key = \`\${name}:\${color}:\${texture}\`
    let type = this.pool.get(key)
    if (!type) {
      type = new ConcreteTreeType(name, color, texture) // cache miss — build once
      this.pool.set(key, type)
    }
    return type // cache hit — reuse the existing flyweight
  }
  // [/getTreeType]

  get poolSize(): number {
    return this.pool.size
  }
}
// [/factory]

// [tree]
class Tree {
  constructor(
    // Extrinsic state: unique per tree, stored outside the flyweight.
    private readonly x: number,
    private readonly y: number,
    private readonly age: number,
    // [holds]
    private readonly type: TreeType, // shared reference, not a private copy
    // [/holds]
  ) {}

  // [treeDraw]
  render(canvas: Canvas): void {
    this.type.draw(canvas, this.x, this.y, this.age)
  }
  // [/treeDraw]
}
// [/tree]

// [forest]
class Forest {
  private readonly trees: Tree[] = []
  private readonly factory = new TreeTypeFactory()

  // [plant]
  plant(x: number, y: number, age: number, name: string, color: string, texture: string): void {
    const type = this.factory.getTreeType(name, color, texture)
    this.trees.push(new Tree(x, y, age, type))
  }
  // [/plant]

  // [render]
  render(canvas: Canvas): void {
    for (const tree of this.trees) tree.render(canvas)
  }
  // [/render]
}
// [/forest]

// [usage]
const forest = new Forest()
for (let i = 0; i < 5_000; i++) {
  forest.plant(Math.random() * 1000, Math.random() * 1000, Math.random() * 50, 'Oak', '#2f6b3a', 'rough-bark.png')
}
for (let i = 0; i < 5_000; i++) {
  forest.plant(Math.random() * 1000, Math.random() * 1000, Math.random() * 50, 'Pine', '#1f4d2e', 'needle-bark.png')
}
// 10,000 Tree objects on the heap, backed by just two shared ConcreteTreeType instances
// [/usage]
`,
  csharp: `
// [usage]
var forest = new Forest();
var random = new Random();
for (var i = 0; i < 5_000; i++)
{
    forest.Plant(random.NextDouble() * 1000, random.NextDouble() * 1000, random.NextDouble() * 50, "Oak", "#2f6b3a", "rough-bark.png");
}
for (var i = 0; i < 5_000; i++)
{
    forest.Plant(random.NextDouble() * 1000, random.NextDouble() * 1000, random.NextDouble() * 50, "Pine", "#1f4d2e", "needle-bark.png");
}
// 10,000 Tree objects on the heap, backed by just two shared ConcreteTreeType instances
// [/usage]

// [canvas]
interface ICanvas
{
    void PaintTree(string color, string texture, double x, double y, double age);
}
// [/canvas]

// [treeType]
interface ITreeType
{
    void Draw(ICanvas canvas, double x, double y, double age);
}
// [/treeType]

// [concreteType]
class ConcreteTreeType : ITreeType
{
    // Intrinsic state: shared and identical for every tree of this species.
    private readonly string _name;
    private readonly string _color;
    private readonly string _texture;

    public ConcreteTreeType(string name, string color, string texture)
    {
        _name = name;
        _color = color;
        _texture = texture;
    }

    // [draw]
    public void Draw(ICanvas canvas, double x, double y, double age)
    {
        // Extrinsic state (x, y, age) arrives as arguments — it is never stored here.
        canvas.PaintTree(_color, _texture, x, y, age);
    }
    // [/draw]
}
// [/concreteType]

// [factory]
class TreeTypeFactory
{
    private readonly Dictionary<string, ConcreteTreeType> _pool = new();

    // [getTreeType]
    public ITreeType GetTreeType(string name, string color, string texture)
    {
        var key = $"{name}:{color}:{texture}";
        if (!_pool.TryGetValue(key, out var type))
        {
            type = new ConcreteTreeType(name, color, texture); // cache miss — build once
            _pool[key] = type;
        }
        return type; // cache hit — reuse the existing flyweight
    }
    // [/getTreeType]

    public int PoolSize => _pool.Count;
}
// [/factory]

// [tree]
class Tree
{
    // Extrinsic state: unique per tree, stored outside the flyweight.
    private readonly double _x;
    private readonly double _y;
    private readonly double _age;
    // [holds]
    private readonly ITreeType _type; // shared reference, not a private copy
    // [/holds]

    public Tree(double x, double y, double age, ITreeType type)
    {
        _x = x;
        _y = y;
        _age = age;
        _type = type;
    }

    // [treeDraw]
    public void Render(ICanvas canvas)
    {
        _type.Draw(canvas, _x, _y, _age);
    }
    // [/treeDraw]
}
// [/tree]

// [forest]
class Forest
{
    private readonly List<Tree> _trees = new();
    private readonly TreeTypeFactory _factory = new();

    // [plant]
    public void Plant(double x, double y, double age, string name, string color, string texture)
    {
        var type = _factory.GetTreeType(name, color, texture);
        _trees.Add(new Tree(x, y, age, type));
    }
    // [/plant]

    // [render]
    public void Render(ICanvas canvas)
    {
        foreach (var tree in _trees) tree.Render(canvas);
    }
    // [/render]
}
// [/forest]
`,
  Visualization: FlyweightVisualization,
}
