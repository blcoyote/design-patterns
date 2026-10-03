import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { StrategyVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "strategy",
  name: "Strategy",
  category: "behavioral",
  order: 2,
  summary: "Encapsulate interchangeable algorithms and swap them at runtime.",
  intent:
    "Put each way of doing a job behind a common interface, so you can swap one for another without changing the code that uses it.",
  problem:
    'A navigation app has to compute a route, but "fastest", "shortest" and "scenic" are three genuinely different algorithms. If you cram all three into one method behind a big if/else, every new option edits that same tangled function. There is also no clean way to let the caller choose, or change, the algorithm while the app runs.',
  solution:
    "Move each algorithm into its own class that implements a shared Strategy interface. The Context (here, Navigator) holds a reference to the current strategy and hands the work to it. It never checks which kind of strategy it has. Calling setStrategy() swaps the algorithm at any time, even in the middle of a session.",
  analogy:
    "Choosing how to get across town: walk, bike or drive. The destination stays the same, but each option gets you there in a different way. You can change your mind about which one to use right up until you leave.",
  whenToUse: [
    "You have several variants of an algorithm and want to pick between them at runtime.",
    "A class is bloated with conditional logic that only chooses between related behaviors.",
    "You want to add new algorithms without touching the code that uses them (Open/Closed).",
  ],
  pros: [
    "You can swap algorithms at runtime without changing the context.",
    "Large conditional blocks that choose between related behaviors go away.",
    "New strategies can be added without touching existing ones (Open/Closed).",
  ],
  cons: [
    "Clients must know the different strategies to pick the right one.",
    "It adds extra classes and indirection, which is a lot for a simple choice.",
    "Strategies usually cannot share logic unless you factor it into a common base.",
  ],
  realWorld: [
    "Array.prototype.sort(compareFn): the comparator is a swappable strategy",
    "Passport.js authentication strategies (local, OAuth, JWT, …)",
    "Payment processing: choosing between card, wallet, or bank-transfer gateways",
    "Compression libraries that let you pick deflate, gzip, or brotli at call time",
  ],
  related: ["state", "template-method", "command", "null-object", "bridge"],
  participants: [
    {
      id: "routeStrategy",
      label: "RouteStrategy",
      role: "Strategy interface",
      kind: "interface",
      x: 400,
      y: 60,
      description:
        "Declares calculate(from, to). Every concrete strategy implements this same signature in its own way; the navigator depends only on this.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 130,
      y: 230,
      description:
        "Picks which strategy the navigator should use, and can swap it at any time with setStrategy().",
    },
    {
      id: "navigator",
      label: "Navigator",
      role: "Context",
      kind: "class",
      x: 400,
      y: 230,
      width: 170,
      description:
        "Holds a reference to the current RouteStrategy and delegates route() to it — it never knows which concrete strategy it holds.",
    },
    {
      id: "fastest",
      label: "FastestRoute",
      role: "Concrete Strategy",
      kind: "class",
      x: 660,
      y: 110,
      description: "Optimizes for travel time, favoring highways.",
    },
    {
      id: "shortest",
      label: "ShortestRoute",
      role: "Concrete Strategy",
      kind: "class",
      x: 660,
      y: 230,
      description: "Optimizes for distance, favoring the most direct path.",
    },
    {
      id: "scenic",
      label: "ScenicRoute",
      role: "Concrete Strategy",
      kind: "class",
      x: 660,
      y: 350,
      description: "Optimizes for a pleasant drive, favoring coastal and scenic roads over speed.",
    },
  ],
  relations: [
    {
      id: "holds",
      from: "navigator",
      to: "routeStrategy",
      type: "holds",
      label: "strategy",
      description:
        "The navigator stores its current strategy typed as RouteStrategy — never as a concrete class.",
      code: "holds",
    },
    {
      id: "fastest-impl",
      from: "fastest",
      to: "routeStrategy",
      type: "implements",
      description: "FastestRoute implements RouteStrategy.",
    },
    {
      id: "shortest-impl",
      from: "shortest",
      to: "routeStrategy",
      type: "implements",
      description: "ShortestRoute implements RouteStrategy.",
    },
    {
      id: "scenic-impl",
      from: "scenic",
      to: "routeStrategy",
      type: "implements",
      description: "ScenicRoute implements RouteStrategy.",
      bend: -30,
    },
    {
      id: "client-call",
      from: "client",
      to: "navigator",
      type: "calls",
      label: "route()",
      description:
        "The client always calls the same route() method, no matter which strategy is currently active.",
      code: "route",
    },
    {
      id: "calc-fastest",
      from: "navigator",
      to: "fastest",
      type: "calls",
      label: "calculate()",
      description: "When FastestRoute is the active strategy, route() delegates to it.",
      code: "route",
    },
    {
      id: "calc-shortest",
      from: "navigator",
      to: "shortest",
      type: "calls",
      label: "calculate()",
      description: "When ShortestRoute is the active strategy, route() delegates to it.",
      code: "route",
    },
    {
      id: "calc-scenic",
      from: "navigator",
      to: "scenic",
      type: "calls",
      label: "calculate()",
      description: "When ScenicRoute is the active strategy, route() delegates to it.",
      code: "route",
    },
  ],
  steps: [
    {
      title: "Configure with FastestRoute",
      description:
        "The client builds a Navigator and hands it a FastestRoute strategy. The navigator stores it only as RouteStrategy.",
      highlight: ["client", "holds", "fastest"],
      notes: { navigator: "strategy: fastest" },
      code: "holds",
    },
    {
      title: "route() delegates to it",
      description:
        "The client calls route(). The navigator has no idea which algorithm it holds — it just calls calculate() on it.",
      highlight: ["client-call", "calc-fastest"],
      packets: [
        { relation: "client-call", label: "route()" },
        { relation: "calc-fastest", label: "calculate()", after: 0 },
      ],
      notes: { fastest: "12 min" },
      code: "route",
    },
    {
      title: "Swap to ScenicRoute",
      description:
        "At runtime, the client calls setStrategy() with a different implementation. The navigator’s code is never modified.",
      highlight: ["holds", "scenic"],
      notes: { navigator: "strategy: scenic" },
      code: "setStrategy",
    },
    {
      title: "Same call, different result",
      description:
        "The client makes the exact same route() call as before. This time it is ScenicRoute doing the work.",
      highlight: ["client-call", "calc-scenic"],
      packets: [
        { relation: "client-call", label: "route()" },
        { relation: "calc-scenic", label: "calculate()", after: 0 },
      ],
      notes: { scenic: "35 min" },
      code: "route",
    },
    {
      title: "Swap to ShortestRoute",
      description:
        "The client swaps strategies again. Any of the three can be plugged in at any time, in any order.",
      highlight: ["holds", "shortest"],
      notes: { navigator: "strategy: shortest" },
      code: "setStrategy",
    },
    {
      title: "A third result, same code path",
      description:
        "route() is called again, unchanged. ShortestRoute now answers, proving the navigator never needed to know about any of them.",
      highlight: ["client-call", "calc-shortest"],
      packets: [
        { relation: "client-call", label: "route()" },
        { relation: "calc-shortest", label: "calculate()", after: 0 },
      ],
      notes: { shortest: "18 min" },
      code: "route",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: StrategyVisualization,
};
