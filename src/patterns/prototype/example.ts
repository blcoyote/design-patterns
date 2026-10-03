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
  style: Style
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
    if (!prototype) throw new Error(`Unknown prototype: ${key}`)
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

const myCircle = registry.clone('circle')
myCircle.style.color = 'red' // safe through the Shape interface alone: style is its own deep copy
;(myCircle as Circle).radius = 50 // a shape-specific tweak still needs the concrete type

const myRect = registry.clone('rectangle') as Rectangle
myRect.width = 100
// [/usage]
