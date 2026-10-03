// [element]
interface Shape {
  accept(visitor: ShapeVisitor): void
}
// [/element]

// [visitor]
interface ShapeVisitor {
  visitCircle(circle: Circle): void
  visitRectangle(rectangle: Rectangle): void
  visitGroup(group: Group): void
}
// [/visitor]

// [circle]
class Circle implements Shape {
  constructor(public readonly radius: number) {}

  accept(visitor: ShapeVisitor): void {
    // [visitCircleMethod]
    visitor.visitCircle(this) // hop 2: dispatches on the visitor's own class
    // [/visitCircleMethod]
  }
}
// [/circle]

// [rectangle]
class Rectangle implements Shape {
  constructor(public readonly width: number, public readonly height: number) {}

  accept(visitor: ShapeVisitor): void {
    // [visitRectangleMethod]
    visitor.visitRectangle(this)
    // [/visitRectangleMethod]
  }
}
// [/rectangle]

// [group]
class Group implements Shape {
  private children: Shape[] = []

  add(shape: Shape): void {
    this.children.push(shape)
  }

  get childCount(): number {
    return this.children.length
  }

  // [groupAccept]
  accept(visitor: ShapeVisitor): void {
    for (const child of this.children) child.accept(visitor) // hop 1, per child
    // [visitGroupMethod]
    visitor.visitGroup(this) // hop 2, for the group itself
    // [/visitGroupMethod]
  }
  // [/groupAccept]
}
// [/group]

// [areaCalculator]
class AreaCalculator implements ShapeVisitor {
  total = 0

  visitCircle(circle: Circle): void {
    this.total += Math.PI * circle.radius ** 2
  }

  visitRectangle(rectangle: Rectangle): void {
    this.total += rectangle.width * rectangle.height
  }

  visitGroup(_group: Group): void {
    // Children already added themselves in above — nothing left to do here.
  }
}
// [/areaCalculator]

// [jsonExporter]
class JsonExporter implements ShapeVisitor {
  private parts: string[] = []

  visitCircle(circle: Circle): void {
    this.parts.push(`{"type":"circle","r":${circle.radius}}`)
  }

  visitRectangle(rectangle: Rectangle): void {
    this.parts.push(`{"type":"rectangle","w":${rectangle.width},"h":${rectangle.height}}`)
  }

  visitGroup(group: Group): void {
    // Every child (leaf or nested group) left exactly one entry behind, so this
    // group's children are the last childCount entries — siblings stay untouched.
    const children = this.parts.splice(this.parts.length - group.childCount)
    this.parts.push(`{"type":"group","children":[${children.join(',')}]}`)
  }

  // Named result(), not toJSON() — toJSON() is a special method name that
  // JSON.stringify() auto-invokes, which would collide with this class's own purpose.
  result(): string {
    return this.parts[0] ?? '{}'
  }
}
// [/jsonExporter]

// [build]
const circle = new Circle(3)
const rectangle = new Rectangle(4, 3)
const group = new Group()
group.add(circle)
group.add(rectangle)
// [/build]

// Usage: swap the operation without changing Circle, Rectangle or Group.
const areaCalculator = new AreaCalculator()
group.accept(areaCalculator)
console.log(areaCalculator.total) // ≈ 40.27

const exporter = new JsonExporter()
group.accept(exporter)
console.log(exporter.result()) // {"type":"group","children":[...]}
