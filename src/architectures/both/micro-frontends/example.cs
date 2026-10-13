using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

// [usage]
var catalog = new CatalogService();
var pricing = new PricingService();
var stock = new StockService();
var recommendations = new RecommendationService();

var checkoutBff = new CheckoutWebBff(pricing, stock);
var mobileBff = new MobileBff(catalog, pricing, stock);

// The shell starts with these three fragments. Register is silent; Deploy, used later, prints.
var registry = new FragmentRegistry();
registry.Register(new ProductFragment(catalog));
registry.Register(new BuyBoxV1(checkoutBff));
registry.Register(new RecommendationsFragment(recommendations));
var shell = new Shell(registry);

Console.WriteLine($"page: {shell.RenderPage("sku-1")}");
Console.WriteLine($"mobile: {MobileWire.ToWire(mobileBff.ProductCard("sku-1"))}");

// The Checkout team ships a new buy box. No other team and not the shell is redeployed.
registry.Deploy(new BuyBoxV2(checkoutBff));

// The recommendation service fails; the page still renders, without that fragment.
recommendations.SetDown(true);
Console.WriteLine("[inspire] recommendation service goes down");
Console.WriteLine($"page: {shell.RenderPage("sku-1")}");

Console.WriteLine(
    $"service calls: catalog {catalog.Calls.ToString(CultureInfo.InvariantCulture)}, pricing {pricing.Calls.ToString(CultureInfo.InvariantCulture)}, stock {stock.Calls.ToString(CultureInfo.InvariantCulture)}, recommendations {recommendations.Calls.ToString(CultureInfo.InvariantCulture)}");
// [/usage]

// [services]
/// <summary>
/// The shared backend services. Each counts its calls: the counter goes up at the start of
/// every call, before anything can fail, so a call that fails is still counted. Money is
/// integer cents everywhere. A sku a service does not know is a programmer bug, so it throws.
/// </summary>
sealed class CatalogService
{
    private readonly Dictionary<string, string> _names = new() { ["sku-1"] = "Widget" };

    public int Calls { get; private set; }

    public string Name(string sku)
    {
        Calls++;
        if (!_names.TryGetValue(sku, out var name))
        {
            throw new InvalidOperationException($"unknown sku {sku}");
        }
        return name;
    }
}

sealed class PricingService
{
    private readonly Dictionary<string, long> _prices = new() { ["sku-1"] = 1999 };

    public int Calls { get; private set; }

    public long PriceCents(string sku)
    {
        Calls++;
        if (!_prices.TryGetValue(sku, out var cents))
        {
            throw new InvalidOperationException($"unknown sku {sku}");
        }
        return cents;
    }
}

sealed class StockService
{
    private readonly Dictionary<string, int> _units = new() { ["sku-1"] = 3 };

    public int Calls { get; private set; }

    public int InStock(string sku)
    {
        Calls++;
        if (!_units.TryGetValue(sku, out var units))
        {
            throw new InvalidOperationException($"unknown sku {sku}");
        }
        return units;
    }
}

/// The one service that can be switched off, to show that a failure stays inside its team's slot.
sealed class RecommendationService
{
    private bool _down = false;
    private readonly Dictionary<string, string[]> _relatedBySku = new()
    {
        ["sku-1"] = new[] { "Gadget", "Gizmo" },
    };

    public int Calls { get; private set; }

    public void SetDown(bool down) => _down = down;

    public List<string> Related(string sku)
    {
        Calls++;
        if (_down) throw new InvalidOperationException("recommendation service unavailable");
        if (!_relatedBySku.TryGetValue(sku, out var names))
        {
            throw new InvalidOperationException($"unknown sku {sku}");
        }
        return names.ToList();
    }
}

static class Money
{
    /// Formats 1999 as "19.99" and -250 as "-2.50" with integer arithmetic only (no floats, no thousands separator).
    public static string FormatCents(long cents)
    {
        long absolute = Math.Abs(cents);
        long whole = absolute / 100;
        long fraction = absolute % 100;
        return $"{(cents < 0 ? "-" : "")}{whole.ToString(CultureInfo.InvariantCulture)}.{fraction.ToString(CultureInfo.InvariantCulture).PadLeft(2, '0')}";
    }
}
// [/services]

// [shell]
/// <summary>
/// What every team hands to the shell: who owns the fragment, which release it is, and a
/// render function that returns an HTML string for one product.
///
/// Fragments here return strings built from trusted constant data. A real fragment must
/// escape every value it puts into markup (names, prices, user input), or it opens the page
/// to injection.
/// </summary>
interface IFragment
{
    string Team { get; }
    string Version { get; }
    string Render(string sku);
}

/// <summary>
/// Which fragment each team currently serves. Register adds a fragment without a word (the
/// set the shell starts with); Deploy is the later release path: it replaces that team's
/// fragment and says so. Either way the team keeps its one slot, and the order of the page
/// comes only from the shell's template, never from this dictionary.
/// </summary>
sealed class FragmentRegistry
{
    private readonly Dictionary<string, IFragment> _fragments = new();

    public void Register(IFragment fragment) => _fragments[fragment.Team] = fragment;

    public void Deploy(IFragment fragment)
    {
        _fragments[fragment.Team] = fragment;
        Console.WriteLine($"[registry] {fragment.Team} deployed {fragment.Version}");
    }

    public IFragment Get(string team)
    {
        // A template slot nobody has registered is a programmer bug, not a failed fragment.
        if (!_fragments.TryGetValue(team, out var fragment))
        {
            throw new InvalidOperationException($"no fragment registered for {team}");
        }
        return fragment;
    }
}

/// <summary>
/// The shell, owned by a platform team: it composes the page. These examples compose on the
/// server, like Server-Side Includes, Edge-Side Includes, Zalando's Tailor or FINN.no's
/// Podium, because they must run as plain code in TypeScript, C#, Python and Go. Many real
/// micro-frontends compose in the browser instead: Webpack Module Federation, Web
/// Components, single-spa or iframes. Neither way is the only one.
///
/// The page template is an ordered list of slots. RenderPage walks that list, never the
/// registry, so the order is the same on every run. If a fragment fails, the shell puts a
/// comment in its slot and carries on: one team's failure does not take the page down.
/// </summary>
sealed class Shell
{
    private readonly string[] _slots = { "product", "checkout", "inspire" };
    private readonly FragmentRegistry _registry;

    public Shell(FragmentRegistry registry)
    {
        _registry = registry;
    }

    public string RenderPage(string sku)
    {
        var parts = new List<string>();
        foreach (var team in _slots)
        {
            var fragment = _registry.Get(team);
            try
            {
                parts.Add(fragment.Render(sku));
            }
            catch (Exception)
            {
                parts.Add($"<!-- {team} unavailable -->");
            }
        }
        return $"<main>{string.Concat(parts)}</main>";
    }
}
// [/shell]

// [productTeam]
/// The Product team's fragment: the product's name as a heading, read from the catalog.
sealed class ProductFragment : IFragment
{
    private readonly CatalogService _catalog;

    public ProductFragment(CatalogService catalog)
    {
        _catalog = catalog;
    }

    public string Team => "product";
    public string Version => "product-details v1";

    public string Render(string sku) => $"<h1>{_catalog.Name(sku)}</h1>";
}
// [/productTeam]

// [checkoutTeam]
/// The one thing the buy box needs to know about a product.
sealed record BuyBoxModel(long PriceCents, int InStock);

/// <summary>
/// The Checkout team's backend for its own web fragment (the Checkout web BFF). It puts one
/// call in front of two services (a facade) and reshapes their answers into the buy box's
/// model (an adapter): that shape and nothing more.
/// </summary>
sealed class CheckoutWebBff
{
    private readonly PricingService _pricing;
    private readonly StockService _stock;

    public CheckoutWebBff(PricingService pricing, StockService stock)
    {
        _pricing = pricing;
        _stock = stock;
    }

    public BuyBoxModel BuyBox(string sku)
    {
        long priceCents = _pricing.PriceCents(sku);
        int inStock = _stock.InStock(sku);
        return new BuyBoxModel(priceCents, inStock);
    }
}

/// Release 1 of the buy box: the price and how many are left.
sealed class BuyBoxV1 : IFragment
{
    private readonly CheckoutWebBff _bff;

    public BuyBoxV1(CheckoutWebBff bff)
    {
        _bff = bff;
    }

    public string Team => "checkout";
    public string Version => "buy-box v1";

    public string Render(string sku)
    {
        var model = _bff.BuyBox(sku);
        return $"<button>Buy for {Money.FormatCents(model.PriceCents)} ({model.InStock.ToString(CultureInfo.InvariantCulture)} left)</button>";
    }
}

/// <summary>
/// Release 2 of the buy box, shipped by the Checkout team alone: new wording, and it no
/// longer shows the stock count. It still asks the BFF for the whole model, so pricing and
/// stock are both still called.
/// </summary>
sealed class BuyBoxV2 : IFragment
{
    private readonly CheckoutWebBff _bff;

    public BuyBoxV2(CheckoutWebBff bff)
    {
        _bff = bff;
    }

    public string Team => "checkout";
    public string Version => "buy-box v2";

    public string Render(string sku)
    {
        var model = _bff.BuyBox(sku);
        return $"<button>Add to basket: {Money.FormatCents(model.PriceCents)}</button>";
    }
}
// [/checkoutTeam]

// [inspireTeam]
/// <summary>
/// The Inspire team's fragment: a list of related products. It does not catch the service's
/// error; deciding what the page does when this fragment fails is the shell's job.
/// </summary>
sealed class RecommendationsFragment : IFragment
{
    private readonly RecommendationService _recommendations;

    public RecommendationsFragment(RecommendationService recommendations)
    {
        _recommendations = recommendations;
    }

    public string Team => "inspire";
    public string Version => "recommendations v1";

    public string Render(string sku)
    {
        var items = _recommendations.Related(sku).Select(name => $"<li>{name}</li>");
        return $"<ul>{string.Concat(items)}</ul>";
    }
}
// [/inspireTeam]

// [mobileBff]
/// What the mobile app gets for a product: strings and a flag, ready to show.
sealed record MobileProductCard(string Name, string Price, bool InStock);

/// <summary>
/// The Mobile team's backend, built for one client type, the mobile app. It puts one call in
/// front of three services (a facade) and reshapes their answers into the app's own card
/// (an adapter): a formatted price and a yes/no instead of a count.
/// </summary>
sealed class MobileBff
{
    private readonly CatalogService _catalog;
    private readonly PricingService _pricing;
    private readonly StockService _stock;

    public MobileBff(CatalogService catalog, PricingService pricing, StockService stock)
    {
        _catalog = catalog;
        _pricing = pricing;
        _stock = stock;
    }

    public MobileProductCard ProductCard(string sku)
    {
        string name = _catalog.Name(sku);
        long cents = _pricing.PriceCents(sku);
        int units = _stock.InStock(sku);
        return new MobileProductCard(name, Money.FormatCents(cents), units > 0);
    }
}

static class MobileWire
{
    /// <summary>
    /// The compact JSON the app receives, written out by hand so every language prints the same
    /// characters: no spaces, keys in this order. The values here are trusted constants; a real
    /// serializer would escape them.
    /// </summary>
    public static string ToWire(MobileProductCard card)
    {
        // bool.ToString() gives "True" in C#, so write the JSON literal by hand.
        return $"{{\"name\":\"{card.Name}\",\"price\":\"{card.Price}\",\"inStock\":{(card.InStock ? "true" : "false")}}}";
    }
}
// [/mobileBff]
