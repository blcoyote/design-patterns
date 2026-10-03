import json
from dataclasses import dataclass
from typing import Callable, Protocol


# [doc]
@dataclass
class Doc:
    title: str
    body: str
# [/doc]


# [exporter]
class Exporter(Protocol):
    id: str

    def export(self, doc: Doc) -> str: ...
# [/exporter]


# [markdownExporter]
class MarkdownExporter:
    id = 'markdown'

    def export(self, doc: Doc) -> str:
        return f'# {doc.title}\n\n{doc.body}'
# [/markdownExporter]


# [htmlExporter]
class HtmlExporter:
    id = 'html'

    def export(self, doc: Doc) -> str:
        return f'<h1>{doc.title}</h1><p>{doc.body}</p>'
# [/htmlExporter]


# A third plugin, added later (see [usage]) to show that the host and the
# registry never have to change to pick up a new exporter.
class JsonExporter:
    id = 'json'

    def export(self, doc: Doc) -> str:
        return json.dumps({'title': doc.title, 'body': doc.body}, separators=(',', ':'))


# [manifest]
# A plain list of the plugin modules to load. In a real build, this list
# itself would usually come from scanning a folder — see the comment on
# `factories` below — but the idea is the same either way: the manifest names
# *what* to load, and each plugin reports its own id once it is constructed.
manifest: list[str] = ['markdown-exporter', 'html-exporter']
# [/manifest]


# [pluginRegistry]
class PluginRegistry:
    def __init__(self) -> None:
        self._exporters: dict[str, Exporter] = {}

    def register(self, exporter: Exporter) -> None:
        self._exporters[exporter.id] = exporter

    def get(self, id: str) -> Exporter:
        exporter = self._exporters.get(id)
        if exporter is None:
            raise RuntimeError(f'no plugin registered for "{id}" (registered: {", ".join(self.registered_ids())})')
        return exporter

    def registered_ids(self) -> list[str]:
        return list(self._exporters.keys())
# [/pluginRegistry]


# [pluginLoader]
# Real discovery mechanisms differ per platform — Vite's `import.meta.glob`
# (this site uses exactly that in src/patterns/registry.ts), .NET assembly
# scanning or MEF, Python's `importlib.metadata` entry points. All of them
# boil down to the same two steps this loader performs explicitly: read a
# manifest, then look each entry up in a map of known factories.
factories: dict[str, Callable[[], Exporter]] = {
    'markdown-exporter': lambda: MarkdownExporter(),
    'html-exporter': lambda: HtmlExporter(),
    'json-exporter': lambda: JsonExporter(),
}


class PluginLoader:
    @staticmethod
    def load(registry: PluginRegistry, module_names: list[str]) -> None:
        for module_name in module_names:
            factory = factories.get(module_name)
            if factory is None:
                raise RuntimeError(f'no factory for plugin module "{module_name}"')
            # Registered under the id the plugin itself reports.
            registry.register(factory())
# [/pluginLoader]


# [host]
class Host:
    def __init__(self, registry: PluginRegistry) -> None:
        self._registry = registry

    def export(self, id: str, doc: Doc) -> str:
        return self._registry.get(id).export(doc)
# [/host]


# [usage]
doc = Doc('Quarterly Report', 'Revenue is up.')

# The host starts with an empty registry, and the loader populates it from the manifest.
registry = PluginRegistry()
PluginLoader.load(registry, manifest)
host = Host(registry)
print(f'registered: {", ".join(registry.registered_ids())}')

print(host.export('html', doc))

# A new plugin is added to the manifest — Host and PluginRegistry are untouched.
extended_manifest = [*manifest, 'json-exporter']
registry2 = PluginRegistry()
PluginLoader.load(registry2, extended_manifest)
host2 = Host(registry2)
print(f'registered: {", ".join(registry2.registered_ids())}')
print(host2.export('json', doc))

try:
    host2.export('pdf', doc)
except RuntimeError as err:
    print(err)
# [/usage]
