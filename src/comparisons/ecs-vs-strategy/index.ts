/**
 * Entity-Component-System and Strategy are both answers to "how do I vary behaviour without an
 * inheritance hierarchy?", but they work at different scales: Strategy plugs one behaviour object
 * into one context, ECS arranges a whole program as ids, data stores and systems. Every claim
 * below was checked against `src/architectures/both/ecs` and `src/patterns/behavioral/strategy`
 * (index.ts and all four language examples), not against the idea in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "ecs-vs-strategy",
  title: "Entity-Component-System vs Strategy",
  order: 12,
  summary:
    "Both vary behaviour without an inheritance hierarchy: Strategy plugs one behaviour object into one context, ECS gives behaviour by which components an entity has.",
  subjects: [
    { kind: "architecture", slug: "ecs" },
    { kind: "pattern", slug: "strategy" },
  ],
  problem:
    "A program has things that behave differently, and a class hierarchy (a base class, subclasses, then more subclasses for every combination) has started to creak. A navigator needs three route algorithms; a game has creatures, props and hazards whose abilities (moving, taking damage, burning) are mixed in different ways and change while the game runs.",
  constraints: [
    "Is the variation one decision inside one object (which algorithm does this object use?), or the ability set of a whole population of things?",
    "Should the behaviour live with the object that uses it, or in one place that acts on every thing that qualifies?",
    "Does someone choose the variant from outside by an explicit call, or does it follow from what data a thing currently has?",
    "How many things are there, and does the way their data is laid out in memory matter?",
    "When something behaves oddly, do you want to read one class, or are you willing to look in several data stores to find out what it is?",
  ],
  dimensions: [
    {
      label: "Intent",
      values: {
        ecs: "Organise a program as ids, plain data and systems, so that what a thing does follows from which components it has rather than from its class.",
        strategy:
          "Put each way of doing one job behind a common interface, so the code that uses it can swap one for another.",
      },
    },
    {
      label: "Scale",
      values: {
        ecs: "Built for many entities handled in bulk: each system loops over every entity that has the components it needs. The example has four entities, three systems and four ticks.",
        strategy:
          "One context object holds one strategy at a time. The example has a single Navigator that is handed three different strategies in turn.",
      },
    },
    {
      label: "Where behaviour lives",
      values: {
        ecs: "In systems: the movement system, damage system and death system are functions over the world. The components are plain data with no methods, and there are no Hero, Goblin or Tree types.",
        strategy:
          "In the strategy objects: FastestRoute, ShortestRoute and ScenicRoute each implement RouteStrategy, and the Navigator hands the work to the one it holds.",
      },
    },
    {
      label: "How the behaviour changes",
      values: {
        ecs: "By adding or removing components. In the example the tree gets a Velocity and the same movement system starts moving it on the next tick.",
        strategy:
          "By an explicit call that swaps the strategy object the context holds. The same route call then runs a different algorithm.",
      },
    },
    {
      label: "Kind of variation",
      values: {
        ecs: "Whether an entity takes part in a behaviour at all (an entity with no Health is not in the damage system's query), and with which data.",
        strategy:
          "Which of several interchangeable ways of doing the same job is used. Every strategy answers the same call.",
      },
    },
    {
      label: "Data layout",
      values: {
        ecs: "An entity is only an id from a counter. Its data is spread over one store per component type, keyed by id, so the tree has entries in the Name and Position stores and none in the Health store.",
        strategy:
          "The context holds one reference to a strategy object. Any data a strategy needs would live in that object; the strategies in the example hold none.",
      },
    },
    {
      label: "Debuggability",
      values: {
        ecs: "An entity has no class to read: to answer 'what is id 3?' you look in every store for that id. Order also matters: the systems run in a fixed order and depend on each other through the data.",
        strategy:
          "What the Navigator does is decided by the one strategy it currently holds, so you read that one class. The cost is the extra indirection through the interface.",
      },
    },
    {
      label: "Performance",
      values: {
        ecs: "Iteration speed is a main reason real engines (Unity's Entities package, Bevy, EnTT, flecs) use dense arrays, sparse sets or archetype tables. This example uses one map per component type, sorts the ids in every query, and is not meant to be fast.",
        strategy:
          "Not what the pattern is about. In the example the Navigator hands each route call to the strategy it holds, and nothing is measured.",
      },
    },
    {
      label: "Weight",
      values: {
        ecs: "A way to structure a whole program: ids, one store per component type, queries and a game loop. More machinery than most applications need.",
        strategy:
          "One interface, a few small classes and one context. It can still be more than a simple choice needs.",
      },
    },
  ],
  options: [
    {
      subject: "ecs",
      changes:
        "There are no classes for things any more. An entity is only an id, its abilities are the components stored under that id, and each behaviour is a system that runs over every entity that has the components it needs. Giving the tree a Velocity is one new entry in a store, and the movement system, which has not changed, now moves it too.",
      chooseWhen: [
        "You have many things of different kinds that share and mix abilities, and the mix changes at runtime, as in a game or a simulation.",
        "You want one behaviour, such as movement, in one place instead of spread over every class that can do it.",
        "Memory layout matters because there are very many entities. That needs real engine storage, which the example does not have.",
        "You accept that an entity has no definition to read, and that the order of the systems is a part of the design.",
      ],
      code: [
        { kind: "architecture", slug: "ecs", region: "movementSystem" },
        { kind: "architecture", slug: "ecs", region: "usage" },
      ],
      steps: [
        { kind: "architecture", slug: "ecs", step: 1 },
        { kind: "architecture", slug: "ecs", step: 7 },
        { kind: "architecture", slug: "ecs", step: 8 },
      ],
    },
    {
      subject: "strategy",
      changes:
        "The Navigator keeps one reference typed as RouteStrategy and hands the route call to it. Calling the set-strategy method with a different implementation changes what the same route call does, and the Navigator's code never checks which strategy it holds.",
      chooseWhen: [
        "One object has a few interchangeable ways of doing one job, and the choice is made from outside, by configuration or by a caller.",
        "The variants are independent of each other and new ones should be added without touching the context.",
        "You want the behaviour to stay with the object that uses it, without a separate world of ids and stores.",
      ],
      code: [
        { kind: "pattern", slug: "strategy", region: "setStrategy" },
        { kind: "pattern", slug: "strategy", region: "route" },
      ],
      steps: [
        { kind: "pattern", slug: "strategy", step: 2 },
        { kind: "pattern", slug: "strategy", step: 3 },
      ],
    },
  ],
  noPattern: {
    when: "A few kinds of things with fixed abilities, or one object with two or three fixed variants that nobody needs to swap at runtime.",
    instead:
      "Write a plain class that holds its own data and rules; the ECS page itself says that for a small application with a few kinds of things, or for business and CRUD software, this is simpler to read and to test than ids, stores and queries. For a single choice between a few algorithms, a switch or a function passed in is enough until the variants grow or need their own state.",
  },
  overlap:
    "They are complementary, not rivals, and a program can use both. Strategy is a pattern for one decision inside one object; ECS is a way to structure a program around data and systems. A component or a system could hold a strategy object for a single decision, such as how something picks a route, while ECS decides which entities take part in the system at all. Nothing in the ECS example does this; it is a way the two can fit together.",
  scenario: {
    prompt:
      "A game has creatures, trees and fires. Which things move, which can be hurt and which burn differs from one thing to the next, and a designer wants a tree to start moving halfway through a level. Which fits best?",
    choices: [
      {
        id: "ecs",
        option: "ecs",
        label: "Entity-Component-System: abilities are components, behaviour is in systems",
        verdict: "best",
        explanation:
          "The ability mix is the thing that varies, it varies across many things, and it changes at runtime. Giving the tree a Velocity is the same one-line change the ECS example shows, and the existing movement system picks it up with no class touched. The price is that you give up a class to read: to know what the tree is, you look in the stores.",
      },
      {
        id: "strategy",
        option: "strategy",
        label: "Strategy: give each object a movement strategy it can swap",
        verdict: "workable",
        explanation:
          "A movement strategy per object can work for a modest number of objects, and it keeps the behaviour next to the object. But Strategy varies how one job is done, not whether a thing takes part in a behaviour, so each further ability (being hurt, burning) needs its own slot on the object's class, and nothing runs the behaviour over every thing that qualifies; you write that loop yourself.",
      },
      {
        id: "plain-class",
        option: "none",
        label: "Plain classes: a class per kind of thing, with its rules inside",
        verdict: "poor",
        explanation:
          "This is the hierarchy that started to creak. A tree that starts moving, or a creature that cannot be hurt, has no place in it, and each new combination of abilities means a new class. A plain class is the right answer for a small program with a few kinds of things, but this scenario is about mixing abilities at runtime.",
      },
    ],
  },
};
