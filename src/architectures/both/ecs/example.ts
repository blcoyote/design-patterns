// [components]
/**
 * Components are plain data: fields and nothing else, no methods. There is no Hero, Goblin
 * or Tree class anywhere in this file; what an entity is follows from which components it
 * has. Positions are integers on a one-dimensional track.
 */
type Name = { value: string };
type Position = { x: number };
type Velocity = { dx: number };
type Health = { hp: number };
/** Damage dealt each tick to every entity with Health that stands at the same x. */
type Hazard = { damage: number };
// [/components]

// [world]
/**
 * The world: it hands out entity ids and keeps one store per component type, keyed by
 * entity id. An entity is only its id; it has no fields and no behaviour of its own.
 *
 * Real engines (Unity's Entities package, Bevy, EnTT, flecs) keep components in dense
 * arrays, sparse sets or archetype tables so that iteration is cache friendly, and that
 * speed is a main reason ECS exists. This example keeps one Map per type and sorts the ids
 * in every query, for clarity and so that all four languages print the same output. It is
 * not meant to be fast.
 */
class World {
  private nextId = 1;
  readonly names = new Map<number, Name>();
  readonly positions = new Map<number, Position>();
  readonly velocities = new Map<number, Velocity>();
  readonly healths = new Map<number, Health>();
  readonly hazards = new Map<number, Hazard>();

  /** Returns the next entity id: 1, 2, 3, and so on. */
  spawn(): number {
    return this.nextId++;
  }

  /**
   * The ids that are in ALL the given stores, in ascending numeric order. Only presence is
   * checked, so the component type does not matter. The result is a new array (a snapshot),
   * so a system may destroy entities while it loops over it.
   */
  query(...stores: ReadonlyMap<number, unknown>[]): number[] {
    const [first, ...rest] = stores;
    if (first === undefined) return [];
    const ids = [...first.keys()].filter((id) => rest.every((store) => store.has(id)));
    // Sort numerically: the default sort compares as strings and would put 10 before 2.
    return ids.sort((a, b) => a - b);
  }

  /** The entity's name. A named entity is assumed here: a missing name is a programmer bug. */
  nameOf(id: number): string {
    const name = this.names.get(id);
    if (name === undefined) throw new Error(`entity ${id} has no Name`);
    return name.value;
  }

  /** Removes the id from every store, so the entity is gone. */
  destroy(id: number): void {
    this.names.delete(id);
    this.positions.delete(id);
    this.velocities.delete(id);
    this.healths.delete(id);
    this.hazards.delete(id);
  }

  /** How many entities have a component in the given store. */
  count(store: ReadonlyMap<number, unknown>): number {
    return store.size;
  }
}
// [/world]

// [movementSystem]
/**
 * Moves every entity that has both a Position and a Velocity. An entity with a Position
 * only, like the tree at first, is not in the query result, so it never moves.
 */
function movementSystem(world: World): void {
  for (const id of world.query(world.positions, world.velocities)) {
    const position = world.positions.get(id);
    const velocity = world.velocities.get(id);
    if (position === undefined || velocity === undefined) continue;
    position.x += velocity.dx;
  }
}
// [/movementSystem]

// [damageSystem]
/**
 * Every hazard hurts every entity that has a Health and stands at the same x. Entities
 * without Health are never touched, so a Position and a Hazard alone does nothing to them.
 * Both loops run in ascending id order, and the hazard loop is nested inside the health loop.
 */
function damageSystem(world: World): void {
  for (const id of world.query(world.positions, world.healths)) {
    const position = world.positions.get(id);
    const health = world.healths.get(id);
    if (position === undefined || health === undefined) continue;
    for (const hazardId of world.query(world.positions, world.hazards)) {
      const hazardPosition = world.positions.get(hazardId);
      const hazard = world.hazards.get(hazardId);
      if (hazardPosition === undefined || hazard === undefined) continue;
      if (hazardPosition.x !== position.x) continue;
      health.hp -= hazard.damage;
      console.log(
        `[damage] ${world.nameOf(id)} takes ${hazard.damage} at ${position.x} (hp ${health.hp})`,
      );
    }
  }
}
// [/damageSystem]

// [deathSystem]
/** Destroys every entity whose Health has dropped to zero or below. */
function deathSystem(world: World): void {
  // The query result is a snapshot, so destroying while looping is safe.
  for (const id of world.query(world.healths)) {
    const health = world.healths.get(id);
    if (health === undefined || health.hp > 0) continue;
    const name = world.nameOf(id);
    world.destroy(id);
    console.log(`[death] ${name} removed`);
  }
}
// [/deathSystem]

// [gameLoop]
/**
 * The systems, in the order a tick runs them. Here they run one after another on one thread,
 * in this fixed order. Real schedulers (Bevy's, Unity's job system) may run systems in
 * parallel when the components they touch do not conflict; this example does not show that.
 */
const systems: ((world: World) => void)[] = [movementSystem, damageSystem, deathSystem];

/** One tick of the game: every system runs once over the whole world. */
function tick(world: World): void {
  for (const system of systems) system(world);
}

/** One line for the world: name@x for each named entity with a Position, plus its hp if it has Health. */
function describe(world: World): string {
  return world
    .query(world.names, world.positions)
    .map((id) => {
      const position = world.positions.get(id);
      if (position === undefined) throw new Error(`entity ${id} has no Position`);
      const health = world.healths.get(id);
      return `${world.nameOf(id)}@${position.x}${health === undefined ? "" : ` hp${health.hp}`}`;
    })
    .join(", ");
}
// [/gameLoop]

// [usage]
const world = new World();

// Four entities. The hero and the goblin have the same set of components; the tree and the fire each have a different one.
const hero = world.spawn();
world.names.set(hero, { value: "hero" });
world.positions.set(hero, { x: 0 });
world.velocities.set(hero, { dx: 1 });
world.healths.set(hero, { hp: 10 });

const goblin = world.spawn();
world.names.set(goblin, { value: "goblin" });
world.positions.set(goblin, { x: 5 });
world.velocities.set(goblin, { dx: -1 });
world.healths.set(goblin, { hp: 2 });

// The tree has a Name and a Position only: for now it cannot move, and it cannot be hurt.
const tree = world.spawn();
world.names.set(tree, { value: "tree" });
world.positions.set(tree, { x: 2 });

// The fire stands still and burns whatever with Health stands on it.
const fire = world.spawn();
world.names.set(fire, { value: "fire" });
world.positions.set(fire, { x: 3 });
world.hazards.set(fire, { damage: 2 });

for (let t = 1; t <= 3; t++) {
  tick(world);
  console.log(`tick ${t}: ${describe(world)}`);
}

// Behaviour changes by adding data: with a Velocity the tree now matches the movement query.
world.velocities.set(tree, { dx: 1 });
console.log("[world] tree gets Velocity(+1)");
tick(world);
console.log(`tick 4: ${describe(world)}`);

console.log(
  `components: position ${world.count(world.positions)}, velocity ${world.count(world.velocities)}, health ${world.count(world.healths)}, hazard ${world.count(world.hazards)}, name ${world.count(world.names)}`,
);
// [/usage]
