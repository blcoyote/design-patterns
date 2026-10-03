import random
from dataclasses import dataclass
from typing import Protocol


# [canvas]
class Canvas(Protocol):
    def paint_tree(self, color: str, texture: str, x: float, y: float, age: float) -> None: ...
# [/canvas]


# [treeType]
class TreeType(Protocol):
    def draw(self, canvas: Canvas, x: float, y: float, age: float) -> None: ...
# [/treeType]


# [concreteType]
# frozen=True: one instance is shared by thousands of trees, so it must be
# immutable (assigning to a field raises FrozenInstanceError).
@dataclass(frozen=True, slots=True)
class ConcreteTreeType:
    # Intrinsic state: shared and identical for every tree of this species.
    name: str
    color: str
    texture: str

    # [draw]
    def draw(self, canvas: Canvas, x: float, y: float, age: float) -> None:
        # Extrinsic state (x, y, age) arrives as arguments — it is never stored here.
        canvas.paint_tree(self.color, self.texture, x, y, age)
    # [/draw]
# [/concreteType]


# [factory]
class TreeTypeFactory:
    def __init__(self) -> None:
        self._pool: dict[str, ConcreteTreeType] = {}

    # [getTreeType]
    def get_tree_type(self, name: str, color: str, texture: str) -> TreeType:
        key = f"{name}:{color}:{texture}"
        tree_type = self._pool.get(key)
        if tree_type is None:
            tree_type = ConcreteTreeType(name, color, texture)  # cache miss — build once
            self._pool[key] = tree_type
        return tree_type  # cache hit — reuse the existing flyweight
    # [/getTreeType]

    @property
    def pool_size(self) -> int:
        return len(self._pool)
# [/factory]


# [tree]
class Tree:
    # __slots__ drops the per-instance __dict__, so each of the thousands of
    # trees stays as small as possible.
    __slots__ = ("_x", "_y", "_age", "_type")

    def __init__(
        self,
        # Extrinsic state: unique per tree, stored outside the flyweight.
        x: float,
        y: float,
        age: float,
        # [holds]
        type_: TreeType,  # shared reference, not a private copy
        # [/holds]
    ) -> None:
        self._x = x
        self._y = y
        self._age = age
        self._type = type_

    # [treeDraw]
    def render(self, canvas: Canvas) -> None:
        self._type.draw(canvas, self._x, self._y, self._age)
    # [/treeDraw]
# [/tree]


# [forest]
class Forest:
    def __init__(self) -> None:
        self._trees: list[Tree] = []
        self._factory = TreeTypeFactory()

    # [plant]
    def plant(self, x: float, y: float, age: float, name: str, color: str, texture: str) -> None:
        tree_type = self._factory.get_tree_type(name, color, texture)
        self._trees.append(Tree(x, y, age, tree_type))
    # [/plant]

    # [render]
    def render(self, canvas: Canvas) -> None:
        for tree in self._trees:
            tree.render(canvas)
    # [/render]

    @property
    def tree_count(self) -> int:
        return len(self._trees)

    @property
    def type_count(self) -> int:
        return self._factory.pool_size
# [/forest]


# [usage]
forest = Forest()
forest.plant(120, 40, 3, "Oak", "#2f6b3a", "rough-bark.png")  # cache miss: builds the Oak type
forest.plant(340, 95, 7, "Oak", "#2f6b3a", "rough-bark.png")  # cache hit: same Oak instance
forest.plant(560, 70, 5, "Pine", "#1f4d2e", "needle-bark.png")  # cache miss: builds the Pine type
for _ in range(4_998):
    forest.plant(random.random() * 1000, random.random() * 1000, random.random() * 50, "Oak", "#2f6b3a", "rough-bark.png")
for _ in range(4_999):
    forest.plant(random.random() * 1000, random.random() * 1000, random.random() * 50, "Pine", "#1f4d2e", "needle-bark.png")
# 10,000 Tree objects in memory (5,000 per species), backed by just two shared ConcreteTreeType instances
print(f"{forest.tree_count} trees, {forest.type_count} tree types")  # 10000 trees, 2 tree types
# [/usage]
