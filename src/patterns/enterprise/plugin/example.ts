// [doc]
interface Doc {
  title: string;
  body: string;
}
// [/doc]

// [exporter]
interface Exporter {
  readonly id: string;
  export(doc: Doc): string;
}
// [/exporter]

// [markdownExporter]
class MarkdownExporter implements Exporter {
  readonly id = "markdown";

  export(doc: Doc): string {
    return `# ${doc.title}\n\n${doc.body}`;
  }
}
// [/markdownExporter]

// [htmlExporter]
class HtmlExporter implements Exporter {
  readonly id = "html";

  export(doc: Doc): string {
    return `<h1>${doc.title}</h1><p>${doc.body}</p>`;
  }
}
// [/htmlExporter]

// A third plugin, added later (see [usage]) to show that the host and the
// registry never have to change to pick up a new exporter.
class JsonExporter implements Exporter {
  readonly id = "json";

  export(doc: Doc): string {
    return JSON.stringify(doc);
  }
}

// [manifest]
// A plain list of the plugin modules to load. In a real build, this list
// itself would usually come from scanning a folder — see the comment on
// `factories` below — but the idea is the same either way: the manifest names
// *what* to load, and each plugin reports its own id once it is constructed.
const manifest: string[] = ["markdown-exporter", "html-exporter"];
// [/manifest]

// [pluginRegistry]
class PluginRegistry {
  private exporters = new Map<string, Exporter>();

  register(exporter: Exporter): void {
    this.exporters.set(exporter.id, exporter);
  }

  get(id: string): Exporter {
    const exporter = this.exporters.get(id);
    if (!exporter) {
      throw new Error(
        `no plugin registered for "${id}" (registered: ${this.registeredIds().join(", ")})`,
      );
    }
    return exporter;
  }

  registeredIds(): string[] {
    return [...this.exporters.keys()];
  }
}
// [/pluginRegistry]

// [pluginLoader]
// Real discovery mechanisms differ per platform — Vite's `import.meta.glob`
// (this site uses exactly that in src/patterns/registry.ts), .NET assembly
// scanning or MEF, Python's `importlib.metadata` entry points. All of them
// boil down to the same two steps this loader performs explicitly: read a
// manifest, then look each entry up in a map of known factories.
type ExporterFactory = () => Exporter;

const factories: Partial<Record<string, ExporterFactory>> = {
  "markdown-exporter": () => new MarkdownExporter(),
  "html-exporter": () => new HtmlExporter(),
  "json-exporter": () => new JsonExporter(),
};

class PluginLoader {
  static load(registry: PluginRegistry, moduleNames: string[]): void {
    for (const moduleName of moduleNames) {
      const factory = factories[moduleName];
      if (!factory) {
        throw new Error(`no factory for plugin module "${moduleName}"`);
      }
      // Registered under the id the plugin itself reports.
      registry.register(factory());
    }
  }
}
// [/pluginLoader]

// [host]
class Host {
  constructor(private registry: PluginRegistry) {}

  export(id: string, doc: Doc): string {
    return this.registry.get(id).export(doc);
  }
}
// [/host]

// [usage]
const doc: Doc = { title: "Quarterly Report", body: "Revenue is up." };

// The host starts with an empty registry, and the loader populates it from the manifest.
const registry = new PluginRegistry();
PluginLoader.load(registry, manifest);
const host = new Host(registry);
console.log(`registered: ${registry.registeredIds().join(", ")}`);

console.log(host.export("html", doc));

// A new plugin is added to the manifest — Host and PluginRegistry are untouched.
const extendedManifest: string[] = [...manifest, "json-exporter"];
const registry2 = new PluginRegistry();
PluginLoader.load(registry2, extendedManifest);
const host2 = new Host(registry2);
console.log(`registered: ${registry2.registeredIds().join(", ")}`);
console.log(host2.export("json", doc));

try {
  host2.export("pdf", doc);
} catch (err) {
  console.log((err as Error).message);
}
// [/usage]
