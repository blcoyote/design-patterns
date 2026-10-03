import math
from typing import Protocol


# [element]
class Shape(Protocol):
    def accept(self, visitor: "ShapeVisitor") -> None: ...
# [/element]


# [visitor]
class ShapeVisitor(Protocol):
    def visit_circle(self, circle: "Circle") -> None: ...
    def visit_rectangle(self, rectangle: "Rectangle") -> None: ...
    def visit_group(self, group: "Group") -> None: ...
# [/visitor]


# [circle]
class Circle:
    def __init__(self, radius: float) -> None:
        self.radius = radius

    def accept(self, visitor: ShapeVisitor) -> None:
        # [visitCircleMethod]
        visitor.visit_circle(self)  # hop 2: dispatches on the visitor's own class
        # [/visitCircleMethod]
# [/circle]


# [rectangle]
class Rectangle:
    def __init__(self, width: float, height: float) -> None:
        self.width = width
        self.height = height

    def accept(self, visitor: ShapeVisitor) -> None:
        # [visitRectangleMethod]
        visitor.visit_rectangle(self)
        # [/visitRectangleMethod]
# [/rectangle]


# [group]
class Group:
    def __init__(self) -> None:
        self._children: list[Shape] = []

    def add(self, shape: Shape) -> None:
        self._children.append(shape)

    @property
    def child_count(self) -> int:
        return len(self._children)

    # [groupAccept]
    def accept(self, visitor: ShapeVisitor) -> None:
        for child in self._children:
            child.accept(visitor)  # hop 1, per child
        # [visitGroupMethod]
        visitor.visit_group(self)  # hop 2, for the group itself
        # [/visitGroupMethod]
    # [/groupAccept]
# [/group]


# [areaCalculator]
class AreaCalculator:
    def __init__(self) -> None:
        self.total = 0.0

    def visit_circle(self, circle: Circle) -> None:
        self.total += math.pi * circle.radius**2

    def visit_rectangle(self, rectangle: Rectangle) -> None:
        self.total += rectangle.width * rectangle.height

    def visit_group(self, group: Group) -> None:
        # Children already added themselves in above — nothing left to do here.
        pass
# [/areaCalculator]


# [jsonExporter]
def _json_number(n: float) -> str:
    # JSON.stringify prints 2.0 as 2; Python would print 2.0.
    return str(int(n)) if float(n).is_integer() else repr(n)


class JsonExporter:
    def __init__(self) -> None:
        self._parts: list[str] = []

    def visit_circle(self, circle: Circle) -> None:
        self._parts.append(f'{{"type":"circle","r":{_json_number(circle.radius)}}}')

    def visit_rectangle(self, rectangle: Rectangle) -> None:
        self._parts.append(f'{{"type":"rectangle","w":{_json_number(rectangle.width)},"h":{_json_number(rectangle.height)}}}')

    def visit_group(self, group: Group) -> None:
        # Every child (leaf or nested group) left exactly one entry behind, so this
        # group's children are the last child_count entries — siblings stay untouched.
        split = len(self._parts) - group.child_count
        children, self._parts = self._parts[split:], self._parts[:split]
        self._parts.append(f'{{"type":"group","children":[{",".join(children)}]}}')

    # result() returns the root entry once the whole tree has been visited.
    def result(self) -> str:
        return self._parts[0] if self._parts else "{}"
# [/jsonExporter]


# [build]
circle = Circle(3)
rectangle = Rectangle(4, 3)
group = Group()
group.add(circle)
group.add(rectangle)
# [/build]

# Usage: swap the operation without changing Circle, Rectangle or Group.
area_calculator = AreaCalculator()
group.accept(area_calculator)
print(area_calculator.total)  # ≈ 40.27

exporter = JsonExporter()
group.accept(exporter)
print(exporter.result())  # {"type":"group","children":[...]}
