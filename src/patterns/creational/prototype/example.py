from typing import Protocol, cast


# [style]
class Style:
    def __init__(self, color: str, line_width: float) -> None:
        self.color = color
        self.line_width = line_width

    def clone(self) -> "Style":
        return Style(self.color, self.line_width)
# [/style]


# [prototype]
class Shape(Protocol):
    style: Style

    def clone(self) -> "Shape": ...
# [/prototype]


# [circle]
class Circle:
    def __init__(self, radius: float, style: Style) -> None:
        self.radius = radius
        self.style = style

    # [circleClone]
    def clone(self) -> "Circle":
        # Deep copy: a fresh Style, not a shared reference to the original's.
        return Circle(self.radius, self.style.clone())
    # [/circleClone]
# [/circle]


# [rectangle]
class Rectangle:
    def __init__(self, width: float, height: float, style: Style) -> None:
        self.width = width
        self.height = height
        self.style = style

    # [rectangleClone]
    def clone(self) -> "Rectangle":
        return Rectangle(self.width, self.height, self.style.clone())
    # [/rectangleClone]
# [/rectangle]


# [registry]
class ShapeRegistry:
    # [holds]
    def __init__(self) -> None:
        self._prototypes: dict[str, Shape] = {}
    # [/holds]

    # [seed]
    def register(self, key: str, prototype: Shape) -> None:
        self._prototypes[key] = prototype
    # [/seed]

    # [registryClone]
    def clone(self, key: str) -> Shape:
        prototype = self._prototypes.get(key)
        if prototype is None:
            raise ValueError(f"Unknown prototype: {key}")
        return prototype.clone()
    # [/registryClone]
# [/registry]


# Usage
# [usage]
registry = ShapeRegistry()
registry.register("circle", Circle(5, Style("black", 1)))
registry.register("rectangle", Rectangle(10, 20, Style("blue", 2)))

my_circle = registry.clone("circle")
my_circle.style.color = "red"  # safe through the Shape protocol alone: style is its own deep copy
cast(Circle, my_circle).radius = 50  # a shape-specific tweak still needs the concrete type

my_rect = cast(Rectangle, registry.clone("rectangle"))
my_rect.width = 100
# [/usage]
