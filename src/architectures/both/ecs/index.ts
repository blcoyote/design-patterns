import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { EcsVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "ecs",
  name: "Entity-Component-System (ECS)",
  paradigm: "both",
  order: 20,
  summary:
    "Entities are bare ids, components are plain data kept in one store per type, and systems are functions that run over every entity that has the components they need; behaviour comes from which components an entity has, not from its class.",
  intent:
    "Entity-Component-System is a way to organise a program as data and the functions that run over it, mostly in games and simulations. An entity is only an id. A component is a small piece of plain data (a position, a velocity, a health value) attached to an id. A system is a function that asks the world for every id that has a certain set of components and then reads or changes those components. Nothing in it is a Hero or a Goblin: what an entity is and does follows from which components it has at the moment. It is a data-oriented style: not classic object orientation (there are no entity classes and no inheritance, and the data has no methods) and not pure functional programming either (the systems here change component data in place). That is why its paradigm badge says both.",
  problem:
    "A game has a hero that moves and can be hurt, a goblin that does the same, a tree that does neither and a fire that hurts whatever stands in it. With classes you start a hierarchy: Entity, then Creature, then Hero and Goblin, with the tree and the fire somewhere else. Then you want a burning tree that moves, or a creature that cannot be hurt, and the hierarchy has no place for it. You end up with deep inheritance, duplicated code, or one giant base class where most fields do not apply. Each new combination of abilities needs a new class, and the behaviour for one ability (moving, say) is scattered over every class that has it.",
  solution:
    "Split what a thing is from what it can do. An entity is only an id from a counter. Each kind of data is a component type with one store that maps entity ids to that data: names, positions, velocities, healths and hazards in this example. To give an entity an ability you add a component to it, and to take one away you remove it. Behaviour lives in systems: the movement system moves every id that has a Position and a Velocity, the damage system hurts every id that has a Position and a Health when a hazard stands at the same x, and the death system destroys every id whose hp has dropped to zero or below. A system finds its entities with a query, which returns the ids that are present in all the stores it names, in ascending id order. A game loop runs the systems in a fixed order once per tick. In this example the world is one 'track' with four entities, run for four ticks, in one process on one thread.",
  analogy:
    "A set of index-card boxes in a library, one box per kind of fact: one for where things are, one for how fast they move, one for how healthy they are. A thing is just a number written on the cards that are about it. Some numbers have a card in the position box and the speed box, others only in the position box. Clerks walk the shelves in a fixed order: the first clerk takes every number that has a card in both the position box and the speed box and updates the position, the next deals with health, the last throws away the cards of anything with no health left. No clerk knows what a 'goblin' is; they only know which boxes a number appears in. A thing changes what it does when someone files a new card for it.",
  whenToUse: [
    "You have many things of different kinds that share and mix abilities, such as a game or a simulation where entities can be moving, burning, controllable or breakable in combinations that change at runtime.",
    "You want behaviour to follow from data, so that adding an ability to one thing is adding a component to it. In the example the tree gains a Velocity in one line and the movement system picks it up on the next tick, with no class changed.",
    "You want each behaviour in one place: all movement is in one system, not spread over every class that can move.",
    "You have so many entities that memory layout matters. This is the other main reason ECS exists, and it needs real engine storage (see Real world), which this example does not have.",
    "Do NOT use it for a small application with a few kinds of things, or for business and CRUD software: a Customer or an Order with its rules in one class is simpler to read and to test, and the indirection of ids, stores and queries costs more than it gives. Also avoid it when you need to see what a thing is by reading one class: an entity has no class, so 'what is id 3?' is answered only by looking in the stores.",
  ],
  pros: [
    "Abilities are combined at runtime without new classes. The four entities have four different sets of components (hero: name, position, velocity, health; goblin: the same; tree: name and position; fire: name, position, hazard), and there is no Hero, Goblin or Tree type anywhere.",
    "Adding a behaviour to a thing is adding data. In tick 4 the tree gets a Velocity and is moved by the same movement system that moves the hero; nothing about the tree's type changed because it has none.",
    "Each system is small and does one thing, and its query names the components it needs. The movement system never reads Health, the damage system never reads Velocity, and an entity with no Health, like the tree standing on the fire in tick 4, is not in its query result, so it is skipped without a special case.",
    "Order and effect are easy to see. The loop is a list of three functions, so the order of a tick is one line of code, and each query states in one line which components its system needs.",
    "It opens the door to memory-friendly layouts and parallel scheduling. Real engines store each component type densely so that a system walks through memory in order, and can run systems at the same time when the components they touch do not overlap. This example shows neither (see the cons), but the shape of the code is what makes them possible.",
  ],
  cons: [
    "It is more machinery than most programs need. For an app with a handful of kinds of things, ids, one store per type and queries are more to write and read than a few classes, and they give you nothing back.",
    "An entity has no definition you can read. To know what the tree is you must look in every store for id 3. Without inspector tooling, finding out why something does or does not move means checking which stores hold its id.",
    "Order and coupling are hidden in data. The systems do not call each other, but they depend on each other through the components and through the order in the list: swapped so that the death system ran before the damage system, the goblin would still be listed with hp 0 after tick 2 and would be removed one tick later. Nothing in the types warns you.",
    "This example is not fast, and it does not claim to be. Real engines (Unity's Entities package, Bevy, EnTT, flecs) keep components in dense arrays, sparse sets or archetype tables so that iteration is cache friendly, and that performance is a main reason ECS exists. Here every component type is one map (Map, Dictionary, dict, map) and every query collects the ids and sorts them, for clarity and so that all four languages print the same lines.",
    "Everything here runs in a fixed order on one thread. Real schedulers, such as Bevy's and Unity's job system, may run systems in parallel when the components they read and write do not conflict. That needs systems to state what they touch, and it brings its own problems (ordering between systems, shared access to the same component). This example does not show it.",
    "It is data-oriented, which cuts both ways. The data has no methods and the rules are in systems, so you lose the encapsulation a class gives: any system can change any component it can reach, and the systems here change component data in place, so they are not the pure functions of a functional core.",
    "Relations between entities (a parent and its children, who is targeting whom) are not built in. You store another entity's id in a component and look it up yourself. This example has no such relation, and real engines add machinery for it.",
  ],
  realWorld: [
    "Game engines: Unity's Entities package (DOTS), Bevy (Rust), EnTT (C++) and flecs (C and C++) are built around ECS. They differ in how they store components: archetype tables (groups of entities with the same component set), sparse sets or dense arrays, with some mixing the layouts. Which does what, and with which options, differs between them and between versions; check the documentation of the one you use.",
    "Blizzard described Overwatch's gameplay code as ECS in a GDC 2017 talk, with systems running over components in a networked game.",
    "Simulations and data-heavy visualisations use the same shape wherever there are many things whose abilities are combined and updated in bulk each frame.",
    "It is rare in business software, where the entities have fixed shapes and rules that fit one class, and where the cost of the indirection is not paid back.",
  ],
  concepts: [
    {
      term: "Entity",
      description:
        "Only an id: a whole number from a counter that starts at 1 (hero 1, goblin 2, tree 3, fire 4). It has no fields and no behaviour of its own, and nothing says what kind of thing it is. An entity exists as far as some store holds its id.",
    },
    {
      term: "Component",
      description:
        "A small piece of plain data with no methods: Name, Position (an integer x on a one-dimensional track), Velocity (dx), Health (hp) and Hazard (damage). An entity has the components that are stored under its id, and different entities have different sets: the tree has a Name and a Position, the fire a Name, a Position and a Hazard. Components are mutable, because the systems change them in place.",
    },
    {
      term: "System",
      description:
        "A function that gets the world and works on every entity that has the components it needs: the movement system needs Position and Velocity, the damage system needs Position and Health (and looks at Position and Hazard for the hazards), the death system needs Health. A system holds no state of its own and owns no entities, and the systems do not call each other.",
    },
    {
      term: "World",
      description:
        "Hands out ids with spawn, holds one store per component type, answers queries, destroys entities and counts the entries in a store. The systems get the world and ask it for ids with a query. In this example they then read and change the components in its stores directly; real engines hide the storage behind more of an interface (see Archetype, sparse set, dense array).",
    },
    {
      term: "Component store",
      description:
        "One map per component type from entity id to that component: Map, Dictionary, dict and map in TypeScript, C#, Python and Go. Only the entities that have the component appear in it. The tick-4 tree has an entry in the Name, Position and Velocity stores and none in Health or Hazard.",
    },
    {
      term: "Query",
      description:
        "Asks the world for the ids that are in ALL the named stores, in ascending numeric order. Only presence is checked, not the type of component. The result is a new list (a snapshot), so a system may destroy entities while looping over it. Querying Position and Velocity in tick 1 gives the hero and the goblin and leaves out the tree and the fire. The ids are sorted so that all four languages give the same order: a Go map, for one, has no defined iteration order.",
    },
    {
      term: "Game loop and tick",
      description:
        "A list of the systems in the order they run, and tick, which runs each of them once over the world: movement, damage, then death. Here the order is fixed and one thread runs them. Real schedulers may run non-conflicting systems in parallel; this example does not.",
    },
    {
      term: "Archetype, sparse set, dense array",
      description:
        "How real engines store components for speed. An archetype table groups the entities with the same component set so that a query walks whole tables in order; a sparse set keeps each component type in a packed array with a lookup from id to slot; a dense array is indexed by id directly. All three aim at cache friendly iteration. This example uses none of them: one map per type, and a sort in every query.",
    },
    {
      term: "Data-oriented design",
      description:
        "The wider idea that ECS is an instance of: arrange the program around the data and how it is read, in bulk, rather than around objects that each own their data and behaviour. It is different from object orientation (no entity classes, no inheritance) and from pure functional programming (the systems here mutate components in place).",
    },
  ],
  variants: [
    {
      name: "Archetype-based and sparse-set-based engines",
      description:
        "The two common ways to store components in real engines. Archetype tables (Unity's Entities package and flecs, among others) move an entity between tables when you add or remove a component and make queries fast; sparse sets (EnTT) make adding and removing cheap. Bevy lets you pick the storage per component type. This example has neither; it uses one map per type.",
    },
    {
      name: "Parallel scheduling",
      description:
        "Because a system's queries say which components it reads and writes, a scheduler can run two systems at the same time when they do not conflict (Bevy's scheduler, Unity's job system). The three systems here run one after another on one thread, in a fixed order, and nothing in them is made thread-safe.",
    },
    {
      name: "ECS without a framework",
      description:
        "A hand-written version, as in this example, is a good way to see the idea but not a way to get the speed. It is also common to start from a library instead of writing the world and the queries yourself.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "iterator",
        why: "A query hides how the matching ids are found and hands a system the ids one after another, in ascending order, whether they came from a map, as here, or from a dense array or an archetype table in a real engine. It is a simple form of Iterator: the query returns a snapshot list that the system loops over, not a cursor object, and it is that snapshot that makes it safe for the death system to destroy entities while it loops.",
      },
    ],
    architectures: [
      {
        slug: "functional-core",
        why: "Both put the logic in functions over plain data. The three systems are plain functions of the world and hold no state of their own, and the components are data with no methods. They are not a functional core, though: the movement, damage and death systems change the component stores in place, where a functional core would not mutate anything. A pure variant would have each system compute new component values and leave it to a shell around the loop to write them back into the stores.",
      },
      {
        slug: "pipes-and-filters",
        why: "Each tick runs the three systems as fixed stages in a set order, movement then damage then death, so a tick looks like a short pipeline. The stages do not pass a message from one to the next, though. Pipes and filters hands each filter the output of the one before it, and here every system reads and writes the same component stores, and the order matters only because of what is in them: a death system that ran before the damage system would remove the goblin one tick later.",
      },
      {
        slug: "mvu",
        why: "Both run one update loop that advances the state step by step. MVU has one Model and an update function that is driven by messages, one at a time. ECS has many component stores that the systems update once per tick, with no messages: tick takes no input and just runs every system over the world, in order.",
      },
    ],
  },

  viewBox: "0 0 1200 700",
  participants: [
    {
      id: "loop",
      label: "Game loop (tick)",
      role: "Runs the systems in order",
      kind: "class",
      x: 460,
      y: 80,
      width: 220,
      description:
        "The list of systems in the order a tick runs them (movement, damage, death) and tick, which runs each of them once over the world. They run one after another on one thread, in this fixed order; real schedulers may run non-conflicting systems in parallel, which this example does not show. The same region has describe, which builds the one-line view of the world that the usage code prints after each tick.",
      code: "gameLoop",
    },
    {
      id: "movement",
      label: "Movement system",
      role: "System",
      kind: "class",
      x: 190,
      y: 260,
      width: 200,
      description:
        "Moves every entity that has both a Position and a Velocity: for each id in the query, it adds dx to x, in place. An entity with a Position only, like the tree at first, is not in the result, so it never moves. It prints nothing.",
      code: "movementSystem",
    },
    {
      id: "damage",
      label: "Damage system",
      role: "System",
      kind: "class",
      x: 460,
      y: 260,
      width: 200,
      description:
        "For each id that has a Position and a Health, in ascending order, it loops over the hazards (the ids with a Position and a Hazard, also ascending) and subtracts the hazard's damage when the two are at the same x, printing '[damage] name takes n at x (hp h)'. Entities without a Health are never touched, so the tree standing on the fire is skipped without a special case.",
      code: "damageSystem",
    },
    {
      id: "death",
      label: "Death system",
      role: "System",
      kind: "class",
      x: 730,
      y: 260,
      width: 200,
      description:
        "For each id with a Health, if hp is zero or below it reads the name, asks the world to destroy the entity and prints '[death] name removed'. It loops over a snapshot of the query result, so destroying while looping is safe.",
      code: "deathSystem",
    },
    {
      id: "world",
      label: "World (entity ids)",
      role: "Ids, stores, query",
      kind: "class",
      x: 1040,
      y: 260,
      width: 200,
      description:
        "Hands out entity ids from a counter, holds one store per component type, answers queries, destroys entities (the id is removed from every store) and counts the entries in a store. The systems ask the world for ids with a query, then read and change the components in its stores. Real engines keep components in dense arrays, sparse sets or archetype tables because iteration speed is a main reason for ECS; this world keeps one map per type and sorts the ids, for clarity, and is not meant to be fast.",
      patterns: ["iterator"],
      code: "world",
    },
    {
      id: "positions",
      label: "Position store",
      role: "Component data",
      kind: "object",
      x: 130,
      y: 540,
      width: 170,
      description:
        "Entity id to Position (an integer x on a one-dimensional track). The hero, the goblin, the tree and the fire have one at the start, so it holds 4 entries, and 3 once the goblin is gone. The movement system changes the entries in place, and the damage system reads them.",
      code: "world",
    },
    {
      id: "velocities",
      label: "Velocity store",
      role: "Component data",
      kind: "object",
      x: 340,
      y: 540,
      width: 170,
      description:
        "Entity id to Velocity (dx per tick). The hero (+1) and the goblin (-1) have one at the start; the goblin's goes with it, and the tree gets one (+1) before tick 4. The movement system reads it.",
      code: "world",
    },
    {
      id: "hazards",
      label: "Hazard store",
      role: "Component data",
      kind: "object",
      x: 550,
      y: 540,
      width: 170,
      description:
        "Entity id to Hazard (damage per tick). Only the fire has one: damage 2. The damage system reads it to find out what hurts whatever stands at the same x.",
      code: "world",
    },
    {
      id: "healths",
      label: "Health store",
      role: "Component data",
      kind: "object",
      x: 760,
      y: 540,
      width: 170,
      description:
        "Entity id to Health (hp). The hero (10) and the goblin (2) have one at the start, and the tree and the fire have none, which is why nothing can hurt them. The damage system subtracts from hp in place, and the death system reads it and destroys any entity at zero or below.",
      code: "world",
    },
    {
      id: "names",
      label: "Name store",
      role: "Component data",
      kind: "object",
      x: 970,
      y: 540,
      width: 170,
      description:
        "Entity id to Name, a label that the systems use in their printed lines and that describe (in the game loop's region) uses for the one-line view. All four entities have one at the start, 3 after the goblin is destroyed. Only describe queries it, to list the named entities that have a Position.",
      code: "world",
    },
  ],
  relations: [
    {
      id: "runMovement",
      from: "loop",
      to: "movement",
      type: "calls",
      label: "run",
      description:
        "tick calls the movement system with the world. It is the first system in the list, so it runs first in every tick.",
      code: "gameLoop",
    },
    {
      id: "runDamage",
      from: "loop",
      to: "damage",
      type: "calls",
      label: "run",
      description:
        "tick calls the damage system with the world, after the movement system has finished, so it sees the positions of this tick.",
      code: "gameLoop",
    },
    {
      id: "runDeath",
      from: "loop",
      to: "death",
      type: "calls",
      label: "run",
      description:
        "tick calls the death system last, so an entity whose hp dropped to zero in the damage system of the same tick is removed in that tick.",
      code: "gameLoop",
    },
    {
      id: "moveWrite",
      from: "movement",
      to: "positions",
      type: "calls",
      label: "x += dx",
      description:
        "For each entity in the query, the movement system adds its dx to the x of its Position, in place. It changes the entry in the store: it does not make a new Position.",
      code: "movementSystem",
    },
    {
      id: "moveRead",
      from: "movement",
      to: "velocities",
      type: "calls",
      label: "read",
      description:
        "The movement system reads the entity's Velocity to know how far to move it. Data travels back along this arrow, from the store to the system.",
      code: "movementSystem",
    },
    {
      id: "damageWrite",
      from: "damage",
      to: "healths",
      type: "calls",
      label: "hp -= damage",
      description:
        "When a hazard stands at the same x as an entity with a Health, the damage system subtracts the hazard's damage from the entity's hp, in place, and prints a line. It also reads the Health through this arrow to get at it.",
      code: "damageSystem",
    },
    {
      id: "damageHazard",
      from: "damage",
      to: "hazards",
      type: "calls",
      label: "read",
      description:
        "For each entity with a Health the damage system reads the hazards: the ids with a Position and a Hazard, and each one's damage. Data travels back along this arrow. The Position reads (the entity's and the hazard's x) are not drawn as an arrow of their own.",
      code: "damageSystem",
    },
    {
      id: "deathRead",
      from: "death",
      to: "healths",
      type: "calls",
      label: "read hp",
      description:
        "The death system reads the hp of every entity that has a Health, in ascending id order, to find those at zero or below. Data travels back along this arrow.",
      code: "deathSystem",
    },
    {
      id: "destroy",
      from: "death",
      to: "world",
      type: "calls",
      label: "destroy",
      description:
        "For an entity at zero or below, the death system asks the world to destroy it. The world removes the id from every store (Name, Position, Velocity, Health and Hazard), whichever of them the entity has, so no component of it is left.",
      code: "deathSystem",
    },
  ],

  steps: [
    {
      title: "Ids, data in stores, systems that query",
      description:
        "There are no Hero, Goblin or Tree classes. An entity is only an id, its data is a set of plain components kept in one store per component type, and the behaviour is in three systems that each ask the world for the ids that have the components they need. The game loop runs the systems in a fixed order once per tick. The dashed boxes group the systems (behaviour, no data) and the component stores (data, no behaviour). This is a small, single-threaded example: real engines store components in dense arrays, sparse sets or archetype tables for speed, and may run systems in parallel. This example does neither.",
      highlight: [
        "loop",
        "movement",
        "damage",
        "death",
        "world",
        "positions",
        "velocities",
        "hazards",
        "healths",
        "names",
      ],
      notes: {
        world: "ids, stores, query",
        movement: "Position + Velocity",
        damage: "Position + Health",
        death: "Health",
      },
      code: "components",
    },
    {
      title: "Spawn: four ids, four different sets of components",
      description:
        "The usage code asks the world for four ids, which come from a counter: 1, 2, 3 and 4. It gives the hero (1) a Name, a Position 0, a Velocity +1 and a Health 10; the goblin (2) a Name, a Position 5, a Velocity -1 and a Health 2; the tree (3) a Name and a Position 2 only; and the fire (4) a Name, a Position 3 and a Hazard 2. The entities have different sets of components, which is the point: nothing says that id 3 is a tree except the Name stored under it and the components it lacks. The stores now hold 4 names, 4 positions, 2 velocities, 2 healths and 1 hazard.",
      highlight: ["world", "names", "positions", "velocities", "healths", "hazards"],
      notes: {
        world: "ids 1, 2, 3, 4",
        names: "4 entries",
        positions: "4 entries",
        velocities: "2 entries",
        healths: "2 entries",
        hazards: "1 entry",
      },
      code: "usage",
    },
    {
      title: "Tick 1, movement: the hero and the goblin move",
      description:
        "The loop runs the movement system. Its query asks for the ids with both a Position and a Velocity, and gets 1 and 2 in ascending order: the hero and the goblin. The tree has no Velocity and the fire has none, so they are not in the result and are not touched. For the hero the system reads dx +1 and moves x from 0 to 1; for the goblin it reads dx -1 and moves x from 5 to 4. It prints nothing.",
      highlight: [
        "loop",
        "runMovement",
        "movement",
        "moveRead",
        "velocities",
        "moveWrite",
        "positions",
      ],
      packets: [
        { relation: "runMovement", label: "tick 1" },
        { relation: "moveRead", label: "hero dx +1", reverse: true, after: 0 },
        { relation: "moveWrite", label: "hero x 0→1", after: 1 },
        { relation: "moveRead", label: "goblin dx -1", reverse: true, after: 2 },
        { relation: "moveWrite", label: "goblin x 5→4", after: 3 },
      ],
      notes: {
        movement: "hero, goblin",
        positions: "hero 1, goblin 4",
      },
      code: "movementSystem",
    },
    {
      title: "Tick 1, damage and death: nobody is hurt",
      description:
        "The loop runs the damage system. Its query asks for the ids with a Position and a Health and gets 1 and 2 (the hero at 1 and the goblin at 4); the tree and the fire have no Health, so they are not in it. For each of them the system reads the hazards (the fire, at 3) and compares x: neither is at 3, so nobody takes damage and nothing is printed. The death system then runs and finds nobody with hp zero or below, so the usage code prints 'tick 1: hero@1 hp10, goblin@4 hp2, tree@2, fire@3'.",
      highlight: [
        "loop",
        "runDamage",
        "damage",
        "damageHazard",
        "hazards",
        "runDeath",
        "death",
        "deathRead",
        "healths",
      ],
      packets: [
        { relation: "runDamage", label: "tick 1" },
        { relation: "damageHazard", label: "fire@3 vs hero@1", reverse: true, after: 0 },
        { relation: "damageHazard", label: "fire@3 vs goblin@4", reverse: true, after: 1 },
        { relation: "runDeath", label: "tick 1", after: 2 },
        { relation: "deathRead", label: "hero hp 10", reverse: true, after: 3 },
        { relation: "deathRead", label: "goblin hp 2", reverse: true, after: 4 },
      ],
      notes: {
        damage: "no hits",
        hazards: "fire at 3",
      },
      code: "damageSystem",
    },
    {
      title: "Tick 2, movement and damage: the goblin takes 2 at the fire",
      description:
        "Tick 2 starts with the movement system: the hero moves to 2 and the goblin to 3, onto the fire. The damage system's query gives 1 and 2 again. The hero at 2 is not at the fire's 3. The goblin is at 3, the same as the fire, so the system subtracts the fire's damage 2 from its hp: 2 becomes 0, and it prints '[damage] goblin takes 2 at 3 (hp 0)'. Nothing is removed yet: removing is the death system's job, and it has not run.",
      highlight: [
        "loop",
        "runMovement",
        "movement",
        "moveRead",
        "velocities",
        "moveWrite",
        "positions",
        "runDamage",
        "damage",
        "damageHazard",
        "hazards",
        "damageWrite",
        "healths",
      ],
      packets: [
        { relation: "runMovement", label: "tick 2" },
        { relation: "moveRead", label: "hero dx +1", reverse: true, after: 0 },
        { relation: "moveWrite", label: "hero x 1→2", after: 1 },
        { relation: "moveRead", label: "goblin dx -1", reverse: true, after: 2 },
        { relation: "moveWrite", label: "goblin x 4→3", after: 3 },
        { relation: "runDamage", label: "tick 2", after: 4 },
        { relation: "damageHazard", label: "fire@3 vs hero@2", reverse: true, after: 5 },
        { relation: "damageHazard", label: "fire@3 vs goblin@3", reverse: true, after: 6 },
        { relation: "damageWrite", label: "goblin hp 2→0", after: 7 },
      ],
      notes: {
        damage: "goblin hit",
        healths: "goblin 0, hero 10",
      },
      code: "damageSystem",
    },
    {
      title: "Tick 2, death: destroy removes id 2 from every store",
      description:
        "The death system's query asks for the ids with a Health and gets 1 and 2. The hero's hp is 10, so it stays. The goblin's hp is 0, so the system reads its name, asks the world to destroy id 2, and prints '[death] goblin removed'. Destroy removes the id from every store: the goblin's Name, Position, Velocity and Health (it has no Hazard, so there is nothing to remove there). The stores now hold 3 names, 3 positions, 1 velocity, 1 health and 1 hazard, and the usage code prints 'tick 2: hero@2 hp10, tree@2, fire@3'.",
      highlight: ["loop", "runDeath", "death", "deathRead", "healths", "destroy", "world"],
      packets: [
        { relation: "runDeath", label: "tick 2" },
        { relation: "deathRead", label: "hero hp 10", reverse: true, after: 0 },
        { relation: "deathRead", label: "goblin hp 0", reverse: true, after: 1 },
        { relation: "destroy", label: "destroy 2", after: 2 },
      ],
      notes: {
        world: "id 2 removed",
        names: "3 entries",
        positions: "3 entries",
        velocities: "1 entry",
        healths: "1 entry",
      },
      code: "deathSystem",
    },
    {
      title: "Tick 3: the hero reaches the fire",
      description:
        "Tick 3: the movement system's query now gives only the hero (1), because the goblin is gone and the tree has no Velocity, and moves it from 2 to 3. The damage system's query gives only the hero too. The hero is at 3, the same as the fire, so 2 is subtracted from its hp: 10 becomes 8, and it prints '[damage] hero takes 2 at 3 (hp 8)'. The death system then finds hp 8 and leaves it. The usage code prints 'tick 3: hero@3 hp8, tree@2, fire@3'.",
      highlight: [
        "loop",
        "runMovement",
        "movement",
        "moveRead",
        "velocities",
        "moveWrite",
        "positions",
        "runDamage",
        "damage",
        "damageHazard",
        "hazards",
        "damageWrite",
        "healths",
        "runDeath",
        "death",
        "deathRead",
      ],
      packets: [
        { relation: "runMovement", label: "tick 3" },
        { relation: "moveRead", label: "hero dx +1", reverse: true, after: 0 },
        { relation: "moveWrite", label: "hero x 2→3", after: 1 },
        { relation: "runDamage", label: "tick 3", after: 2 },
        { relation: "damageHazard", label: "fire@3 vs hero@3", reverse: true, after: 3 },
        { relation: "damageWrite", label: "hero hp 10→8", after: 4 },
        { relation: "runDeath", label: "tick 3", after: 5 },
        { relation: "deathRead", label: "hero hp 8", reverse: true, after: 6 },
      ],
      notes: {
        positions: "hero 3",
        healths: "hero 8",
      },
      code: "damageSystem",
    },
    {
      title: "Composition: the tree gets a Velocity at runtime",
      description:
        "The usage code adds a Velocity +1 to the tree (id 3) and prints '[world] tree gets Velocity(+1)'. No class changes and nothing is registered anywhere: there is one more entry in the Velocity store, under 3. From now on the tree is in the movement system's query result, because it has both a Position and a Velocity, so the next tick will move it. The Velocity store now holds 2 entries, the hero's and the tree's. What an entity does follows from the components it has.",
      highlight: ["velocities", "movement", "world"],
      notes: {
        velocities: "hero, tree",
        movement: "tree now matches",
      },
      code: "usage",
    },
    {
      title: "Tick 4: the tree moves onto the fire and is not hurt",
      description:
        "The movement system's query now gives 1 and 3, the hero and the tree: the hero moves from 3 to 4 and the tree from 2 to 3, onto the fire. The damage system's query asks for a Position and a Health and gives only the hero, since the tree has no Health. The tree is at the same x as the fire but is never looked at, so nothing is printed for it, and the hero at 4 is not at 3 either. The death system finds hp 8 and leaves it. The usage code prints 'tick 4: hero@4 hp8, tree@3, fire@3'.",
      highlight: [
        "loop",
        "runMovement",
        "movement",
        "moveRead",
        "velocities",
        "moveWrite",
        "positions",
        "runDamage",
        "damage",
        "damageHazard",
        "hazards",
        "runDeath",
        "death",
        "deathRead",
        "healths",
      ],
      packets: [
        { relation: "runMovement", label: "tick 4" },
        { relation: "moveRead", label: "hero dx +1", reverse: true, after: 0 },
        { relation: "moveWrite", label: "hero x 3→4", after: 1 },
        { relation: "moveRead", label: "tree dx +1", reverse: true, after: 2 },
        { relation: "moveWrite", label: "tree x 2→3", after: 3 },
        { relation: "runDamage", label: "tick 4", after: 4 },
        { relation: "damageHazard", label: "fire@3 vs hero@4", reverse: true, after: 5 },
        { relation: "runDeath", label: "tick 4", after: 6 },
        { relation: "deathRead", label: "hero hp 8", reverse: true, after: 7 },
      ],
      notes: {
        positions: "hero 4, tree 3",
        damage: "tree skipped",
      },
      code: "movementSystem",
    },
    {
      title: "Final counts: the stores differ in size",
      description:
        "The usage code prints 'components: position 3, velocity 2, health 1, hazard 1, name 3'. The stores hold different numbers of entries because the entities have different sets of components: three of them have a Position (the hero, the tree and the fire), the hero and the tree have a Velocity, only the hero has a Health, only the fire has a Hazard and three have a Name. The goblin is in none, because destroy removed it from every store. Real engines would keep each of these stores in a dense or sparse layout built for fast iteration; here each is one map.",
      highlight: ["world", "positions", "velocities", "hazards", "healths", "names"],
      notes: {
        positions: "3",
        velocities: "2",
        hazards: "1",
        healths: "1",
        names: "3",
      },
      code: "usage",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: EcsVisualization,
};
