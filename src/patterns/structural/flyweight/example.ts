// [canvas]
interface Canvas {
  paintTree(color: string, texture: string, x: number, y: number, age: number): void;
}
// [/canvas]

// [treeType]
interface TreeType {
  draw(canvas: Canvas, x: number, y: number, age: number): void;
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
    canvas.paintTree(this.color, this.texture, x, y, age);
  }
  // [/draw]
}
// [/concreteType]

// [factory]
class TreeTypeFactory {
  private readonly pool = new Map<string, ConcreteTreeType>();

  // [getTreeType]
  getTreeType(name: string, color: string, texture: string): TreeType {
    const key = `${name}:${color}:${texture}`;
    let type = this.pool.get(key);
    if (!type) {
      type = new ConcreteTreeType(name, color, texture); // cache miss — build once
      this.pool.set(key, type);
    }
    return type; // cache hit — reuse the existing flyweight
  }
  // [/getTreeType]

  get poolSize(): number {
    return this.pool.size;
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
    this.type.draw(canvas, this.x, this.y, this.age);
  }
  // [/treeDraw]
}
// [/tree]

// [forest]
class Forest {
  private readonly trees: Tree[] = [];
  private readonly factory = new TreeTypeFactory();

  // [plant]
  plant(x: number, y: number, age: number, name: string, color: string, texture: string): void {
    const type = this.factory.getTreeType(name, color, texture);
    this.trees.push(new Tree(x, y, age, type));
  }
  // [/plant]

  // [render]
  render(canvas: Canvas): void {
    for (const tree of this.trees) tree.render(canvas);
  }
  // [/render]
}
// [/forest]

// [usage]
const forest = new Forest();
for (let i = 0; i < 5_000; i++) {
  forest.plant(
    Math.random() * 1000,
    Math.random() * 1000,
    Math.random() * 50,
    "Oak",
    "#2f6b3a",
    "rough-bark.png",
  );
}
for (let i = 0; i < 5_000; i++) {
  forest.plant(
    Math.random() * 1000,
    Math.random() * 1000,
    Math.random() * 50,
    "Pine",
    "#1f4d2e",
    "needle-bark.png",
  );
}
// 10,000 Tree objects on the heap, backed by just two shared ConcreteTreeType instances
// [/usage]
