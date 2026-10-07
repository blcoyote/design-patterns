import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "plugin",
  name: "Plugin",
  category: "enterprise",
  order: 2,
  summary:
    "Choose implementations at configuration or start-up time instead of hard-wiring them into the host, so adding one needs no change to the host.",
  intent:
    "Let a host application pick up new implementations at start-up or configuration time, through a registry, without changing its own code.",
  problem:
    "A host program that calls concrete implementations directly has to be edited, recompiled and redeployed every time a new one shows up: a new export format, a new payment provider, a new notification channel. The host and every implementation are compiled together, so adding one more case means touching code that otherwise has nothing to do with it. A big if/switch keyed on type keeps growing.",
  solution:
    "Define a narrow interface that the host depends on, plus a registry that looks plugins up by id. A loader reads a manifest, which is a plain list of the plugin modules to load, builds each one from a map of known factories, and registers it under the id the plugin itself reports, all before the host runs. The host only ever calls registry.get(id) and never names a concrete plugin class, so enabling an already-available plugin is just a manifest change. (A brand-new implementation also needs its code and a factory entry the loader can find.) In Fowler's original Plugin, the configuration names the implementation class and a factory instantiates it by reflection, often to pick one implementation per environment (an in-memory ID generator in tests, a database sequence in production). This example uses a factory map instead, so which plugins run is configured, but every implementation is still compiled in.",
  analogy:
    "A power strip only knows the shape of a plug, not which appliance is attached. Adding a lamp or a charger never means rewiring the strip. You plug it in and it works, because both sides agreed on the socket shape ahead of time.",
  whenToUse: [
    "Third parties or other teams need to add behavior without touching or recompiling the host.",
    "The set of implementations is open-ended or configured per deployment (which exporters, which payment providers, which checks run).",
    "You want new capabilities to arrive as an added file or package, not an edited one.",
    'A growing if/switch over a "type" field is the only thing standing between the host and a new case.',
  ],
  pros: [
    "Enabling or disabling a plugin is a manifest edit. Adding a new one means adding its code and a factory entry (or letting real discovery find it); the host and registry are never edited.",
    "Keeps the host small: it depends on one interface and one registry, never on concrete implementations.",
    "Plugins can be developed, tested and even distributed independently of the host.",
    "The manifest is one explicit place that lists everything currently wired in.",
  ],
  cons: [
    "It adds indirection. To find out what runs for id X, you follow the manifest and the factory map, not just the host.",
    "A misspelled module name fails at load time, but a plugin that is simply missing from the manifest only fails when something asks the registry for its id.",
    'Real discovery mechanisms (classpath or assembly scanning, bundler globs) can make plugins "just appear". That is convenient, but easy to lose track of.',
  ],
  realWorld: [
    "VS Code extensions, discovered and activated from a manifest without the editor knowing about any of them at compile time",
    "Vite and webpack plugins, each one an object implementing a known hook interface (Vite: named hooks; webpack: an apply(compiler) method) and listed in a config array",
    "Python packaging's entry_points, which let an installed package register itself under a group a host scans for",
    "Eclipse OSGi bundles, discovered and wired together at start-up",
    'This site: src/patterns/registry.ts and src/architectures/registry.ts auto-discover every pattern and architecture folder with import.meta.glob — CLAUDE.md says "Never hand-register a pattern".',
  ],
  related: ["strategy", "abstract-factory", "factory-method", "dependency-injection"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "host",
      label: "Host",
      role: "Client",
      kind: "client",
      x: 110,
      y: 250,
      width: 150,
      description:
        "A document exporter host. It depends on PluginRegistry and the Exporter interface only, and never names a concrete exporter class.",
    },
    {
      id: "manifest",
      label: "Manifest",
      role: "Configuration data",
      kind: "object",
      x: 250,
      y: 80,
      width: 150,
      description:
        "A plain list of the plugin modules to load. Editing this list is all it takes to enable or disable a plugin the loader already has a factory for.",
    },
    {
      id: "pluginLoader",
      label: "PluginLoader",
      role: "Loader",
      kind: "class",
      x: 440,
      y: 80,
      width: 160,
      description:
        "Reads the manifest, looks each module name up in a map of known factories (failing with a clear error for an unknown one), and registers the resulting exporter with the registry.",
    },
    {
      id: "pluginRegistry",
      label: "PluginRegistry",
      role: "Registry",
      kind: "class",
      x: 650,
      y: 250,
      width: 180,
      description:
        "Holds exporters in a map keyed by id. get(id) returns the matching plugin or throws a clear error listing which ids are actually registered.",
    },
    {
      id: "exporter",
      label: "Exporter",
      role: "Plugin interface",
      kind: "interface",
      x: 440,
      y: 390,
      width: 180,
      description:
        "The only contract the host and the registry know about: an id and an export(doc) method. Every plugin implements exactly this.",
    },
    {
      id: "markdownExporter",
      label: "MarkdownExporter",
      role: "Concrete Plugin",
      kind: "class",
      x: 650,
      y: 390,
      width: 180,
      description: 'Renders a document as Markdown. Registered under the id "markdown".',
    },
    {
      id: "htmlExporter",
      label: "HtmlExporter",
      role: "Concrete Plugin",
      kind: "class",
      x: 230,
      y: 390,
      width: 180,
      description: 'Renders a document as HTML. Registered under the id "html".',
    },
  ],
  relations: [
    {
      id: "loaderReadsManifest",
      from: "pluginLoader",
      to: "manifest",
      type: "calls",
      label: "read manifest",
      description:
        "The loader reads the manifest before anything is registered — a plain list of module names, not code.",
      code: "pluginLoader",
    },
    {
      id: "loaderRegisters",
      from: "pluginLoader",
      to: "pluginRegistry",
      type: "calls",
      label: "register(exporter)",
      description:
        "For each manifest entry, the loader builds the plugin from the factory map and registers it under the id the plugin reports.",
      bend: 20,
      code: "pluginLoader",
    },
    {
      id: "markdownImpl",
      from: "markdownExporter",
      to: "exporter",
      type: "implements",
      description:
        "MarkdownExporter implements Exporter, so the registry and host can hold and call it through the interface alone.",
      code: "markdownExporter",
    },
    {
      id: "htmlImpl",
      from: "htmlExporter",
      to: "exporter",
      type: "implements",
      description:
        "HtmlExporter implements the same Exporter interface — the host cannot tell the two apart except by id.",
      code: "htmlExporter",
    },
    {
      id: "registryHolds",
      from: "pluginRegistry",
      to: "exporter",
      type: "holds",
      label: "map: id → Exporter",
      description:
        "The registry keeps every registered plugin in a map keyed by id, typed only as Exporter.",
      code: "pluginRegistry",
    },
    {
      id: "hostGet",
      from: "host",
      to: "pluginRegistry",
      type: "calls",
      label: "get(id)",
      description:
        "The host asks the registry for a plugin by id. It never constructs or names a concrete exporter class.",
      bend: -15,
      code: "host",
    },
    {
      id: "hostExport",
      from: "host",
      to: "exporter",
      type: "calls",
      label: "export(doc)",
      description:
        "Once the host has a plugin back from the registry, it calls export() on it through the Exporter interface.",
      code: "host",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Host starts with an empty registry",
      description:
        "Before anything loads, PluginRegistry holds no exporters at all. The host cannot do anything useful yet.",
      highlight: ["host", "pluginRegistry"],
      notes: { pluginRegistry: "registered: (none)" },
      code: "pluginRegistry",
    },
    {
      title: "The loader reads the manifest",
      description:
        'PluginLoader reads a plain list of module names — two entries, "markdown-exporter" and "html-exporter".',
      highlight: ["pluginLoader", "manifest", "loaderReadsManifest"],
      notes: { manifest: "markdown-exporter, html-exporter" },
      code: "manifest",
    },
    {
      title: "The loader registers each plugin under its id",
      description:
        'For every manifest entry, the loader builds the plugin from the factory map and registers it under the id the plugin reports ("markdown", "html"). MarkdownExporter and HtmlExporter both implement Exporter, so the registry can hold both the same way.',
      highlight: [
        "pluginLoader",
        "pluginRegistry",
        "loaderRegisters",
        "markdownExporter",
        "htmlExporter",
        "markdownImpl",
        "htmlImpl",
        "registryHolds",
      ],
      notes: { pluginRegistry: "registered: markdown, html" },
      code: "pluginLoader",
    },
    {
      title: 'The host asks for "html"',
      description:
        'The host calls registry.get("html"). It never references HtmlExporter by name — only the id.',
      highlight: ["host", "pluginRegistry", "hostGet"],
      packets: [{ relation: "hostGet", label: 'get("html")' }],
      notes: { host: "needs the html exporter" },
      code: "host",
    },
    {
      title: "The registry returns the plugin, and the host calls export()",
      description:
        "The registry hands back the HtmlExporter instance, typed as Exporter. The host calls export(doc) on it without knowing which concrete class it got.",
      highlight: ["pluginRegistry", "host", "hostGet", "hostExport", "exporter", "htmlExporter"],
      packets: [
        { relation: "hostGet", label: "HtmlExporter", reverse: true },
        { relation: "hostExport", label: "export(doc)", after: 0 },
      ],
      notes: { host: "<h1>Quarterly Report</h1><p>Revenue is up.</p>" },
      code: "host",
    },
    {
      title: "A new plugin is added to the manifest — the host is untouched",
      description:
        'A third module name, "json-exporter", is appended to the manifest. JsonExporter and its factory entry already exist, so PluginLoader and PluginRegistry run unchanged; Host and its export() method are not edited at all.',
      highlight: ["manifest", "pluginLoader", "pluginRegistry"],
      notes: { pluginRegistry: "registered: markdown, html, json" },
      code: "usage",
    },
    {
      title: "An unknown id fails with a clear error",
      description:
        'Asking the registry for "pdf" — a plugin that was never registered — throws an error that names the id and lists every id that actually is registered, so the mistake is obvious immediately.',
      highlight: ["host", "pluginRegistry", "hostGet"],
      notes: {
        pluginRegistry: 'no plugin registered for "pdf" (registered: markdown, html, json)',
      },
      code: "usage",
    },
  ],

  // Regions: `// [id]` … `// [/id]`. A participant highlights the region with its own id by default.
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,

  // Generic diagram is used — no custom Visualization.
};
