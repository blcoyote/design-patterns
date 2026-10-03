// [routeStrategy]
interface RouteStrategy {
  calculate(from: string, to: string): Route;
}
// [/routeStrategy]

interface Route {
  minutes: number;
  summary: string;
}

// [fastest]
class FastestRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 12, summary: `highway from ${from} to ${to}` };
  }
}
// [/fastest]

// [shortest]
class ShortestRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 18, summary: `direct path from ${from} to ${to}` };
  }
}
// [/shortest]

// [scenic]
class ScenicRoute implements RouteStrategy {
  calculate(from: string, to: string): Route {
    return { minutes: 35, summary: `coastal road from ${from} to ${to}` };
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
    this.strategy = strategy;
  }
  // [/setStrategy]

  // [route]
  route(from: string, to: string): Route {
    return this.strategy.calculate(from, to);
  }
  // [/route]
}
// [/navigator]

// Usage
const nav = new Navigator(new FastestRoute());
nav.route("Home", "Office"); // { minutes: 12, ... }

nav.setStrategy(new ScenicRoute());
nav.route("Home", "Office"); // { minutes: 35, ... } — same call, different algorithm

nav.setStrategy(new ShortestRoute());
nav.route("Home", "Office"); // { minutes: 18, ... }
