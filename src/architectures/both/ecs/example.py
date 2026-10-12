from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass


# [components]
# Components are plain data: fields and nothing else, no methods. There is no Hero, Goblin
# or Tree class anywhere in this file; what an entity is follows from which components it
# has. Positions are integers on a one-dimensional track. The dataclasses are mutable
# because the systems change x and hp in place.


@dataclass
class Name:
    value: str


@dataclass
class Position:
    x: int


@dataclass
class Velocity:
    dx: int


@dataclass
class Health:
    hp: int


@dataclass
class Hazard:
    """Damage dealt each tick to every entity with Health that stands at the same x."""

    damage: int
# [/components]


# [world]
class World:
    """
    The world: it hands out entity ids and keeps one store per component type, keyed by
    entity id. An entity is only its id; it has no fields and no behaviour of its own.

    Real engines (Unity's Entities package, Bevy, EnTT, flecs) keep components in dense
    arrays, sparse sets or archetype tables so that iteration is cache friendly, and that
    speed is a main reason ECS exists. This example keeps one dict per type and sorts the ids
    in every query, for clarity and so that all four languages print the same output. It is
    not meant to be fast.
    """

    def __init__(self) -> None:
        self._next_id = 1
        self.names: dict[int, Name] = {}
        self.positions: dict[int, Position] = {}
        self.velocities: dict[int, Velocity] = {}
        self.healths: dict[int, Health] = {}
        self.hazards: dict[int, Hazard] = {}

    def spawn(self) -> int:
        """Returns the next entity id: 1, 2, 3, and so on."""
        entity_id = self._next_id
        self._next_id += 1
        return entity_id

    def query(self, *stores: Mapping[int, object]) -> list[int]:
        """
        The ids that are in ALL the given stores, in ascending numeric order. Only presence is
        checked, so the component type does not matter. The result is a new list (a snapshot),
        so a system may destroy entities while it loops over it.
        """
        if not stores:
            return []
        first, *rest = stores
        # Sort explicitly: a dict iterates in insertion order, which is not id order once
        # entities have been destroyed and components added later.
        return sorted(entity_id for entity_id in first if all(entity_id in store for store in rest))

    def name_of(self, entity_id: int) -> str:
        """The entity's name. A named entity is assumed here: a missing name is a programmer bug."""
        name = self.names.get(entity_id)
        if name is None:
            raise LookupError(f"entity {entity_id} has no Name")
        return name.value

    def destroy(self, entity_id: int) -> None:
        """Removes the id from every store, so the entity is gone."""
        self.names.pop(entity_id, None)
        self.positions.pop(entity_id, None)
        self.velocities.pop(entity_id, None)
        self.healths.pop(entity_id, None)
        self.hazards.pop(entity_id, None)

    def count(self, store: Mapping[int, object]) -> int:
        """How many entities have a component in the given store."""
        return len(store)
# [/world]


# [movementSystem]
def movement_system(world: World) -> None:
    """
    Moves every entity that has both a Position and a Velocity. An entity with a Position
    only, like the tree at first, is not in the query result, so it never moves.
    """
    for entity_id in world.query(world.positions, world.velocities):
        world.positions[entity_id].x += world.velocities[entity_id].dx
# [/movementSystem]


# [damageSystem]
def damage_system(world: World) -> None:
    """
    Every hazard hurts every entity that has a Health and stands at the same x. Entities
    without Health are never touched, so a Position and a Hazard alone does nothing to them.
    Both loops run in ascending id order, and the hazard loop is nested inside the health loop.
    """
    for entity_id in world.query(world.positions, world.healths):
        position = world.positions[entity_id]
        health = world.healths[entity_id]
        for hazard_id in world.query(world.positions, world.hazards):
            hazard = world.hazards[hazard_id]
            if world.positions[hazard_id].x != position.x:
                continue
            health.hp -= hazard.damage
            print(
                f"[damage] {world.name_of(entity_id)} takes {hazard.damage} at {position.x} "
                f"(hp {health.hp})"
            )
# [/damageSystem]


# [deathSystem]
def death_system(world: World) -> None:
    """Destroys every entity whose Health has dropped to zero or below."""
    # The query result is a snapshot, so destroying while looping is safe.
    for entity_id in world.query(world.healths):
        if world.healths[entity_id].hp > 0:
            continue
        name = world.name_of(entity_id)
        world.destroy(entity_id)
        print(f"[death] {name} removed")
# [/deathSystem]


# [gameLoop]
# The systems, in the order a tick runs them. Here they run one after another on one thread,
# in this fixed order. Real schedulers (Bevy's, Unity's job system) may run systems in
# parallel when the components they touch do not conflict; this example does not show that.
SYSTEMS: list[Callable[[World], None]] = [movement_system, damage_system, death_system]


def tick(world: World) -> None:
    """One tick of the game: every system runs once over the whole world."""
    for system in SYSTEMS:
        system(world)


def describe(world: World) -> str:
    """One line for the world: name@x for each named entity with a Position, plus its hp if it has Health."""
    parts: list[str] = []
    for entity_id in world.query(world.names, world.positions):
        health = world.healths.get(entity_id)
        hp = "" if health is None else f" hp{health.hp}"
        parts.append(f"{world.name_of(entity_id)}@{world.positions[entity_id].x}{hp}")
    return ", ".join(parts)
# [/gameLoop]


# [usage]
world = World()

# Four entities, each with a different set of components.
hero = world.spawn()
world.names[hero] = Name("hero")
world.positions[hero] = Position(0)
world.velocities[hero] = Velocity(1)
world.healths[hero] = Health(10)

goblin = world.spawn()
world.names[goblin] = Name("goblin")
world.positions[goblin] = Position(5)
world.velocities[goblin] = Velocity(-1)
world.healths[goblin] = Health(2)

# The tree has a Name and a Position only: for now it cannot move, and it cannot be hurt.
tree = world.spawn()
world.names[tree] = Name("tree")
world.positions[tree] = Position(2)

# The fire stands still and burns whatever with Health stands on it.
fire = world.spawn()
world.names[fire] = Name("fire")
world.positions[fire] = Position(3)
world.hazards[fire] = Hazard(2)

for t in range(1, 4):
    tick(world)
    print(f"tick {t}: {describe(world)}")

# Behaviour changes by adding data: with a Velocity the tree now matches the movement query.
world.velocities[tree] = Velocity(1)
print("[world] tree gets Velocity(+1)")
tick(world)
print(f"tick 4: {describe(world)}")

print(
    f"components: position {world.count(world.positions)}, "
    f"velocity {world.count(world.velocities)}, "
    f"health {world.count(world.healths)}, "
    f"hazard {world.count(world.hazards)}, "
    f"name {world.count(world.names)}"
)
# [/usage]
