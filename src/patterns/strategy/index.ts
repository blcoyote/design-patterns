import type { PatternDefinition } from '@/types/pattern'
import { StrategyVisualization } from './Visualization'

export const pattern: PatternDefinition = {
  slug: 'strategy',
  name: 'Strategy',
  category: 'behavioral',
  order: 2,
  summary: 'Encapsulate interchangeable algorithms and swap them at runtime.',
  intent:
    'Define a family of interchangeable algorithms, encapsulate each one, and make them interchangeable behind a common interface so the code that uses them never has to change.',
  problem:
    'A navigation app needs to compute a route, but "fastest", "shortest" and "scenic" are three genuinely different algorithms. Cramming all three into one method behind a big if/else means every new option edits the same tangled function, and there is no clean way to let a caller choose or change the algorithm at runtime.',
  solution:
    'Extract each algorithm into its own class implementing a shared Strategy interface. The Context (Navigator) holds a reference to the current strategy and delegates to it — it never branches on type, and setStrategy() lets any caller swap the algorithm at any time, even mid-session.',
  analogy:
    'Choosing how to get across town: walking, biking, or driving. The destination never changes, but each strategy gets you there differently — and you can change your mind about which one to use right up until you leave.',
  whenToUse: [
    'You have several variants of an algorithm and want to choose between them at runtime.',
    'A class is bloated with conditional logic that only selects between related behaviors.',
    'You want to add new algorithms without touching the code that uses them (Open/Closed).',
  ],
  pros: [
    'Swaps algorithms at runtime without changing the context.',
    'Eliminates large conditional blocks that select between related behaviors.',
    'New strategies can be added without touching existing ones (Open/Closed).',
  ],
  cons: [
    'Clients must be aware of the different strategies to pick the right one.',
    'Adds extra classes and indirection for what might be a simple choice.',
    'Strategies cannot usually share logic unless factored into a common base.',
  ],
  realWorld: [
    'Array.prototype.sort(compareFn) — the comparator is a swappable strategy',
    'Passport.js authentication strategies (local, OAuth, JWT, …)',
    'Payment processing: choosing between card, wallet, or bank-transfer gateways',
    'Compression libraries that let you pick zip, gzip, or brotli at call time',
  ],
  related: ['state', 'template-method', 'command', 'null-object', 'bridge'],
  participants: [
    {
      id: 'routeStrategy',
      label: 'RouteStrategy',
      role: 'Strategy interface',
      kind: 'interface',
      x: 400,
      y: 60,
      description: 'Declares calculate(from, to). Every concrete strategy implements it the same way; the navigator depends only on this.',
    },
    {
      id: 'client',
      label: 'Client',
      role: 'Client',
      kind: 'client',
      x: 130,
      y: 230,
      description: 'Picks which strategy the navigator should use, and can swap it at any time with setStrategy().',
    },
    {
      id: 'navigator',
      label: 'Navigator',
      role: 'Context',
      kind: 'class',
      x: 400,
      y: 230,
      width: 170,
      description: 'Holds a reference to the current RouteStrategy and delegates route() to it — it never knows which concrete strategy it holds.',
    },
    {
      id: 'fastest',
      label: 'FastestRoute',
      role: 'Concrete Strategy',
      kind: 'class',
      x: 660,
      y: 110,
      description: 'Optimizes for travel time, favoring highways.',
    },
    {
      id: 'shortest',
      label: 'ShortestRoute',
      role: 'Concrete Strategy',
      kind: 'class',
      x: 660,
      y: 230,
      description: 'Optimizes for distance, favoring the most direct path.',
    },
    {
      id: 'scenic',
      label: 'ScenicRoute',
      role: 'Concrete Strategy',
      kind: 'class',
      x: 660,
      y: 350,
      description: 'Optimizes for a pleasant drive, favoring coastal and scenic roads over speed.',
    },
  ],
  relations: [
    {
      id: 'holds',
      from: 'navigator',
      to: 'routeStrategy',
      type: 'holds',
      label: 'strategy',
      description: 'The navigator stores its current strategy typed as RouteStrategy — never as a concrete class.',
      code: 'holds',
    },
    { id: 'fastest-impl', from: 'fastest', to: 'routeStrategy', type: 'implements', description: 'FastestRoute implements RouteStrategy.' },
    { id: 'shortest-impl', from: 'shortest', to: 'routeStrategy', type: 'implements', description: 'ShortestRoute implements RouteStrategy.' },
    {
      id: 'scenic-impl',
      from: 'scenic',
      to: 'routeStrategy',
      type: 'implements',
      description: 'ScenicRoute implements RouteStrategy.',
      bend: -30,
    },
    {
      id: 'client-call',
      from: 'client',
      to: 'navigator',
      type: 'calls',
      label: 'route()',
      description: 'The client always calls the same route() method, no matter which strategy is currently active.',
      code: 'route',
    },
    {
      id: 'calc-fastest',
      from: 'navigator',
      to: 'fastest',
      type: 'calls',
      label: 'calculate()',
      description: 'When FastestRoute is the active strategy, route() delegates to it.',
      code: 'route',
    },
    {
      id: 'calc-shortest',
      from: 'navigator',
      to: 'shortest',
      type: 'calls',
      label: 'calculate()',
      description: 'When ShortestRoute is the active strategy, route() delegates to it.',
      code: 'route',
    },
    {
      id: 'calc-scenic',
      from: 'navigator',
      to: 'scenic',
      type: 'calls',
      label: 'calculate()',
      description: 'When ScenicRoute is the active strategy, route() delegates to it.',
      code: 'route',
    },
  ],
  steps: [
    {
      title: 'Configure with FastestRoute',
      description: 'The client builds a Navigator and hands it a FastestRoute strategy. The navigator stores it only as RouteStrategy.',
      highlight: ['client', 'holds', 'fastest'],
      notes: { navigator: 'strategy: fastest' },
      code: 'holds',
    },
    {
      title: 'route() delegates to it',
      description: 'The client calls route(). The navigator has no idea which algorithm it holds — it just calls calculate() on it.',
      highlight: ['client-call', 'calc-fastest'],
      packets: [
        { relation: 'client-call', label: 'route()' },
        { relation: 'calc-fastest', label: 'calculate()' },
      ],
      notes: { fastest: '12 min' },
      code: 'route',
    },
    {
      title: 'Swap to ScenicRoute',
      description: 'At runtime, the client calls setStrategy() with a different implementation. The navigator’s code is never modified.',
      highlight: ['holds', 'scenic'],
      notes: { navigator: 'strategy: scenic' },
      code: 'setStrategy',
    },
    {
      title: 'Same call, different result',
      description: 'The client makes the exact same route() call as before. This time it is ScenicRoute doing the work.',
      highlight: ['client-call', 'calc-scenic'],
      packets: [
        { relation: 'client-call', label: 'route()' },
        { relation: 'calc-scenic', label: 'calculate()' },
      ],
      notes: { scenic: '35 min' },
      code: 'route',
    },
    {
      title: 'Swap to ShortestRoute',
      description: 'The client swaps strategies again. Any of the three can be plugged in at any time, in any order.',
      highlight: ['holds', 'shortest'],
      notes: { navigator: 'strategy: shortest' },
      code: 'setStrategy',
    },
    {
      title: 'A third result, same code path',
      description: 'route() is called again, unchanged. ShortestRoute now answers, proving the navigator never needed to know about any of them.',
      highlight: ['client-call', 'calc-shortest'],
      packets: [
        { relation: 'client-call', label: 'route()' },
        { relation: 'calc-shortest', label: 'calculate()' },
      ],
      notes: { shortest: '18 min' },
      code: 'route',
    },
  ],
  code: `
// [routeStrategy]
interface RouteStrategy {
  calculate(from: string, to: string): Route
}
// [/routeStrategy]

interface Route {
  minutes: number
  summary: string
}

// [fastest]
class FastestRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 12, summary: \`highway from \${from} to \${to}\` }
  }
}
// [/fastest]

// [shortest]
class ShortestRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 18, summary: \`direct path from \${from} to \${to}\` }
  }
}
// [/shortest]

// [scenic]
class ScenicRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 35, summary: \`coastal road from \${from} to \${to}\` }
  }
}
// [/scenic]

// [navigator]
class Navigator {
  // [holds]
  constructor(private strategy: RouteStrategy) {}
  // [/holds]

  // [setStrategy]
  setStrategy(strategy: RouteStrategy) {
    this.strategy = strategy
  }
  // [/setStrategy]

  // [route]
  route(from: string, to: string): Route {
    return this.strategy.calculate(from, to)
  }
  // [/route]
}
// [/navigator]

// Usage
const nav = new Navigator(new FastestRoute())
nav.route('Home', 'Office') // { minutes: 12, ... }

nav.setStrategy(new ScenicRoute())
nav.route('Home', 'Office') // { minutes: 35, ... } — same call, different algorithm

nav.setStrategy(new ShortestRoute())
nav.route('Home', 'Office') // { minutes: 18, ... }
`,
  csharp: `
// A real C# app would often just pass a Func<string, string, Route> delegate
// instead of a RouteStrategy interface, but we keep the explicit pattern
// structure here for clarity.

// Usage
var nav = new Navigator(new FastestRoute());
nav.CalculateRoute("Home", "Office"); // { Minutes = 12, ... }

nav.SetStrategy(new ScenicRoute());
nav.CalculateRoute("Home", "Office"); // { Minutes = 35, ... } — same call, different algorithm

nav.SetStrategy(new ShortestRoute());
nav.CalculateRoute("Home", "Office"); // { Minutes = 18, ... }

// [routeStrategy]
interface IRouteStrategy
{
    Route Calculate(string from, string to);
}
// [/routeStrategy]

record Route(int Minutes, string Summary);

// [fastest]
class FastestRoute : IRouteStrategy
{
    public Route Calculate(string from, string to) => new(12, $"highway from {from} to {to}");
}
// [/fastest]

// [shortest]
class ShortestRoute : IRouteStrategy
{
    public Route Calculate(string from, string to) => new(18, $"direct path from {from} to {to}");
}
// [/shortest]

// [scenic]
class ScenicRoute : IRouteStrategy
{
    public Route Calculate(string from, string to) => new(35, $"coastal road from {from} to {to}");
}
// [/scenic]

// [navigator]
class Navigator
{
    // [holds]
    private IRouteStrategy _strategy;

    public Navigator(IRouteStrategy strategy)
    {
        _strategy = strategy;
    }
    // [/holds]

    // [setStrategy]
    public void SetStrategy(IRouteStrategy strategy)
    {
        _strategy = strategy;
    }
    // [/setStrategy]

    // [route]
    public Route CalculateRoute(string from, string to)
    {
        return _strategy.Calculate(from, to);
    }
    // [/route]
}
// [/navigator]
`,
  Visualization: StrategyVisualization,
}
