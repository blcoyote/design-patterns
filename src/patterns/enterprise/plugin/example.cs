// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).

// [usage]
var doc = new Doc("Quarterly Report", "Revenue is up.");

// The host starts with an empty registry, and the loader populates it from the manifest.
var registry = new PluginRegistry();
PluginLoader.Load(registry, Manifest.Entries);
var host = new Host(registry);
Console.WriteLine($"registered: {string.Join(", ", registry.RegisteredIds())}");

Console.WriteLine(host.Export("html", doc));

// A new plugin is added to the manifest — Host and PluginRegistry are untouched.
var extendedManifest = Manifest.Entries.Append(new ManifestEntry("json", "json-exporter")).ToList();
var registry2 = new PluginRegistry();
PluginLoader.Load(registry2, extendedManifest);
var host2 = new Host(registry2);
Console.WriteLine($"registered: {string.Join(", ", registry2.RegisteredIds())}");
Console.WriteLine(host2.Export("json", doc));

try
{
    host2.Export("pdf", doc);
}
catch (InvalidOperationException err)
{
    Console.WriteLine(err.Message);
}
// [/usage]

// [doc]
record Doc(string Title, string Body);
// [/doc]

// [exporter]
interface IExporter
{
    string Id { get; }
    string Export(Doc doc);
}
// [/exporter]

// [markdownExporter]
class MarkdownExporter : IExporter
{
    public string Id => "markdown";

    public string Export(Doc doc) => $"# {doc.Title}\n\n{doc.Body}";
}
// [/markdownExporter]

// [htmlExporter]
class HtmlExporter : IExporter
{
    public string Id => "html";

    public string Export(Doc doc) => $"<h1>{doc.Title}</h1><p>{doc.Body}</p>";
}
// [/htmlExporter]

// A third plugin, added later (see [usage]) to show that the host and the
// registry never have to change to pick up a new exporter.
class JsonExporter : IExporter
{
    public string Id => "json";

    public string Export(Doc doc) => $"{{\"title\":\"{doc.Title}\",\"body\":\"{doc.Body}\"}}";
}

// [manifest]
// A plain list of plugin ids and the factory module each one maps to. In a
// real build, this list itself would usually come from scanning a folder —
// see the comment on `Factories` below — but the manifest *shape* is the
// same either way: plugin id → the name of the thing that constructs it.
record ManifestEntry(string Id, string Module);

static class Manifest
{
    public static readonly IReadOnlyList<ManifestEntry> Entries = new List<ManifestEntry>
    {
        new("markdown", "markdown-exporter"),
        new("html", "html-exporter"),
    };
}
// [/manifest]

// [pluginRegistry]
class PluginRegistry
{
    private readonly Dictionary<string, IExporter> _exporters = new();

    public void Register(IExporter exporter) => _exporters[exporter.Id] = exporter;

    public IExporter Get(string id)
    {
        if (!_exporters.TryGetValue(id, out var exporter))
        {
            throw new InvalidOperationException($"no plugin registered for \"{id}\" (registered: {string.Join(", ", RegisteredIds())})");
        }
        return exporter;
    }

    public IReadOnlyList<string> RegisteredIds() => _exporters.Keys.ToList();
}
// [/pluginRegistry]

// [pluginLoader]
// Real discovery mechanisms differ per platform — Vite's `import.meta.glob`
// (this site uses exactly that, see the registry below), .NET assembly
// scanning or MEF, Python's `importlib.metadata` entry points. All of them
// boil down to the same two steps this loader performs explicitly: read a
// manifest, then look each entry up in a map of known factories.
static class PluginLoader
{
    private static readonly Dictionary<string, Func<IExporter>> Factories = new()
    {
        ["markdown-exporter"] = () => new MarkdownExporter(),
        ["html-exporter"] = () => new HtmlExporter(),
        ["json-exporter"] = () => new JsonExporter(),
    };

    public static void Load(PluginRegistry registry, IEnumerable<ManifestEntry> entries)
    {
        foreach (var entry in entries)
        {
            registry.Register(Factories[entry.Module]());
        }
    }
}
// [/pluginLoader]

// [host]
class Host(PluginRegistry registry)
{
    public string Export(string id, Doc doc) => registry.Get(id).Export(doc);
}
// [/host]
