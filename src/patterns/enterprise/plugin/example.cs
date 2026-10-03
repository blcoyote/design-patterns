using System.Text.Json;

// Usage (top-level statements must come before type declarations in a
// C# file, so this runs first even though it reads last).

// [usage]
var doc = new Doc("Quarterly Report", "Revenue is up.");

// The host starts with an empty registry, and the loader populates it from the manifest.
var registry = new PluginRegistry();
PluginLoader.Load(registry, Manifest.Modules);
var host = new Host(registry);
Console.WriteLine($"registered: {string.Join(", ", registry.RegisteredIds())}");

Console.WriteLine(host.Export("html", doc));

// A new plugin is added to the manifest — Host and PluginRegistry are untouched.
var extendedManifest = Manifest.Modules.Append("json-exporter").ToList();
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

    public string Export(Doc doc) => JsonSerializer.Serialize(new { title = doc.Title, body = doc.Body });
}

// [manifest]
// A plain list of the plugin modules to load. In a real build, this list
// itself would usually come from scanning a folder — see the comment on
// `Factories` below — but the idea is the same either way: the manifest names
// *what* to load, and each plugin reports its own id once it is constructed.
static class Manifest
{
    public static readonly IReadOnlyList<string> Modules = ["markdown-exporter", "html-exporter"];
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
// (this site uses exactly that in src/patterns/registry.ts), .NET assembly
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

    public static void Load(PluginRegistry registry, IEnumerable<string> moduleNames)
    {
        foreach (var moduleName in moduleNames)
        {
            if (!Factories.TryGetValue(moduleName, out var factory))
            {
                throw new InvalidOperationException($"no factory for plugin module \"{moduleName}\"");
            }
            // Registered under the id the plugin itself reports.
            registry.Register(factory());
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
