using System.Text.Json;

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).
// [usage]
var profiles = new ProfileService();
var orders = new OrderService();
var recommendations = new RecommendationService();
var webBff = new WebBff(profiles, orders, recommendations);
var mobileBff = new MobileBff(profiles, orders);

Clients.ShowWebAccount(webBff, "alice"); // three service calls: heading, two order lines, three picks
Clients.ShowMobileHome(mobileBff, "alice"); // {"name":"Alice","orderCount":2,"lastOrder":"order-2"}
Clients.ShowMobileHome(mobileBff, "bob"); // {"name":"Bob","orderCount":0,"lastOrder":null}

Console.WriteLine("[recommendations] down");
recommendations.Down = true;
Clients.ShowWebAccount(webBff, "bob"); // no orders, recommended: unavailable

Console.WriteLine(FormattableString.Invariant(
    $"service calls: profile {profiles.Calls}, orders {orders.Calls}, recommendations {recommendations.Calls}")); // profile 4, orders 4, recommendations 2
// [/usage]

// [services]
// Shared backend services. They know nothing about the clients and return their
// data in one general shape. Each counts its calls first thing, so the usage can
// show which services a request reached.
record Profile(string Name, string Email);

record Order(string Id, int Items, int TotalCents);

class ProfileService
{
    public int Calls { get; private set; }

    private readonly Dictionary<string, Profile> _profiles = new()
    {
        ["alice"] = new Profile("Alice", "alice@example.com"),
        ["bob"] = new Profile("Bob", "bob@example.com"),
    };

    public Profile Profile(string userId)
    {
        Calls++;
        if (!_profiles.TryGetValue(userId, out var found))
        {
            throw new ArgumentException($"unknown user {userId}");
        }
        return found;
    }
}

class OrderService
{
    public int Calls { get; private set; }

    private readonly Dictionary<string, List<Order>> _orders = new()
    {
        ["alice"] = [new Order("order-1", 2, 1250), new Order("order-2", 3, 4999)],
    };

    // Oldest first; bob has no entry, so no orders.
    public IReadOnlyList<Order> Recent(string userId)
    {
        Calls++;
        return _orders.TryGetValue(userId, out var found) ? found : [];
    }
}

class RecommendationService
{
    public int Calls { get; private set; }
    public bool Down { get; set; } // the usage switches this on to show a failing service

    private readonly Dictionary<string, List<string>> _picks = new()
    {
        ["alice"] = ["socks", "mug", "lamp"],
        ["bob"] = ["notebook"],
    };

    public IReadOnlyList<string> ForUser(string userId)
    {
        Calls++;
        if (Down)
        {
            throw new InvalidOperationException("recommendations unavailable");
        }
        return _picks.TryGetValue(userId, out var found) ? found : [];
    }
}
// [/services]

// [webBff]
// The web team's backend. The account page shows everything, so it calls all
// three services and returns a page model shaped for the web UI. Calls run one
// after another here to keep the example deterministic; a real BFF would
// usually make independent calls in parallel.
record AccountPage(
    string Heading,
    IReadOnlyList<string> OrderLines,
    IReadOnlyList<string>? Recommended); // null: the section could not be filled

class WebBff(ProfileService profiles, OrderService orders, RecommendationService recommendations)
{
    // Integer division and remainder, so no culture-specific decimal separator.
    static string FormatCents(int cents) =>
        FormattableString.Invariant($"{cents / 100}.{cents % 100:D2}");

    public AccountPage AccountPage(string userId)
    {
        var profile = profiles.Profile(userId);
        var recent = orders.Recent(userId);
        IReadOnlyList<string>? recommended;
        try
        {
            recommended = recommendations.ForUser(userId);
        }
        catch (InvalidOperationException)
        {
            recommended = null; // the web page degrades: the rest of it is still served
        }
        return new AccountPage(
            $"{profile.Name} ({profile.Email})",
            recent.Select(order =>
                FormattableString.Invariant($"{order.Id}: {order.Items} items, {FormatCents(order.TotalCents)}")).ToList(),
            recommended);
    }
}
// [/webBff]

// [mobileBff]
// The mobile team's backend. The app's home screen shows a small card, so this
// BFF calls only the two services it needs, never recommendations, and answers
// with compact JSON in the app's own field names.
record MobileHomeCard(string Name, int OrderCount, string? LastOrder);

class MobileBff(ProfileService profiles, OrderService orders)
{
    static readonly JsonSerializerOptions Wire = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public string Home(string userId)
    {
        var profile = profiles.Profile(userId);
        var recent = orders.Recent(userId);
        var card = new MobileHomeCard(profile.Name, recent.Count, recent.Count == 0 ? null : recent[^1].Id);
        return JsonSerializer.Serialize(card, Wire);
    }
}
// [/mobileBff]

// [clients]
// Each client knows only its own BFF, never the services behind it.
static class Clients
{
    public static void ShowWebAccount(WebBff bff, string userId)
    {
        var page = bff.AccountPage(userId);
        Console.WriteLine($"[web] {page.Heading}");
        if (page.OrderLines.Count == 0)
        {
            Console.WriteLine("[web]   no orders");
        }
        foreach (var line in page.OrderLines)
        {
            Console.WriteLine($"[web]   {line}");
        }
        var recommended = page.Recommended is null ? "unavailable" : string.Join(", ", page.Recommended);
        Console.WriteLine($"[web]   recommended: {recommended}");
    }

    public static void ShowMobileHome(MobileBff bff, string userId)
    {
        Console.WriteLine($"[mobile] {bff.Home(userId)}");
    }
}
// [/clients]
