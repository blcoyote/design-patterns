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
