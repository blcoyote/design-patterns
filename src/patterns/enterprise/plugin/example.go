package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// [doc]
type Doc struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// [/doc]

// [exporter]
// Go interfaces are satisfied implicitly: any type with these methods is an
// Exporter, no "implements" declaration needed.
type Exporter interface {
	ID() string
	Export(doc Doc) string
}

// [/exporter]

// [markdownExporter]
type MarkdownExporter struct{}

func (MarkdownExporter) ID() string { return "markdown" }

func (MarkdownExporter) Export(doc Doc) string {
	return "# " + doc.Title + "\n\n" + doc.Body
}

// [/markdownExporter]

// [htmlExporter]
type HtmlExporter struct{}

func (HtmlExporter) ID() string { return "html" }

func (HtmlExporter) Export(doc Doc) string {
	return "<h1>" + doc.Title + "</h1><p>" + doc.Body + "</p>"
}

// [/htmlExporter]

// A third plugin, added later (see [usage]) to show that the host and the
// registry never have to change to pick up a new exporter.
type JsonExporter struct{}

func (JsonExporter) ID() string { return "json" }

func (JsonExporter) Export(doc Doc) string {
	out, _ := json.Marshal(doc)
	return string(out)
}

// [manifest]
// A plain list of plugin ids and the factory module each one maps to. In a
// real build, this list itself would usually come from scanning a folder —
// see the comment on `factories` below — but the manifest *shape* is the
// same either way: plugin id -> the name of the thing that constructs it.
type ManifestEntry struct {
	ID     string
	Module string
}

var manifest = []ManifestEntry{
	{"markdown", "markdown-exporter"},
	{"html", "html-exporter"},
}

// [/manifest]

// [pluginRegistry]
type PluginRegistry struct {
	exporters map[string]Exporter
	order     []string // registration order, because Go map iteration order is random
}

func NewPluginRegistry() *PluginRegistry {
	return &PluginRegistry{exporters: map[string]Exporter{}}
}

func (r *PluginRegistry) Register(exporter Exporter) {
	if _, exists := r.exporters[exporter.ID()]; !exists {
		r.order = append(r.order, exporter.ID())
	}
	r.exporters[exporter.ID()] = exporter
}

func (r *PluginRegistry) Get(id string) (Exporter, error) {
	exporter, ok := r.exporters[id]
	if !ok {
		return nil, fmt.Errorf("no plugin registered for %q (registered: %s)", id, strings.Join(r.RegisteredIds(), ", "))
	}
	return exporter, nil
}

func (r *PluginRegistry) RegisteredIds() []string {
	return append([]string(nil), r.order...)
}

// [/pluginRegistry]

// [pluginLoader]
// Real discovery mechanisms differ per platform — Vite's `import.meta.glob`
// (this site uses exactly that, see the registry below), .NET assembly
// scanning or MEF, Python's `importlib.metadata` entry points. All of them
// boil down to the same two steps this loader performs explicitly: read a
// manifest, then look each entry up in a map of known factories.
type ExporterFactory func() Exporter

var factories = map[string]ExporterFactory{
	"markdown-exporter": func() Exporter { return MarkdownExporter{} },
	"html-exporter":     func() Exporter { return HtmlExporter{} },
	"json-exporter":     func() Exporter { return JsonExporter{} },
}

type PluginLoader struct{}

func (PluginLoader) Load(registry *PluginRegistry, entries []ManifestEntry) {
	for _, entry := range entries {
		factory := factories[entry.Module]
		registry.Register(factory())
	}
}

// [/pluginLoader]

// [host]
type Host struct {
	registry *PluginRegistry
}

func (h *Host) Export(id string, doc Doc) (string, error) {
	exporter, err := h.registry.Get(id)
	if err != nil {
		return "", err
	}
	return exporter.Export(doc), nil
}

// [/host]

// [usage]
func main() {
	doc := Doc{Title: "Quarterly Report", Body: "Revenue is up."}

	// The host starts with an empty registry, and the loader populates it from the manifest.
	registry := NewPluginRegistry()
	PluginLoader{}.Load(registry, manifest)
	host := &Host{registry: registry}
	fmt.Printf("registered: %s\n", strings.Join(registry.RegisteredIds(), ", "))

	out, _ := host.Export("html", doc)
	fmt.Println(out)

	// A new plugin is added to the manifest — Host and PluginRegistry are untouched.
	extendedManifest := append(append([]ManifestEntry(nil), manifest...), ManifestEntry{"json", "json-exporter"})
	registry2 := NewPluginRegistry()
	PluginLoader{}.Load(registry2, extendedManifest)
	host2 := &Host{registry: registry2}
	fmt.Printf("registered: %s\n", strings.Join(registry2.RegisteredIds(), ", "))
	out, _ = host2.Export("json", doc)
	fmt.Println(out)

	if _, err := host2.Export("pdf", doc); err != nil {
		fmt.Println(err)
	}
}

// [/usage]
