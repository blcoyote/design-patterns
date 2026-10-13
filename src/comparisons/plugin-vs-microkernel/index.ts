/**
 * Plugin (a design pattern) and Microkernel (an architecture) are two sizes of the same idea:
 * code that is loaded and called through an interface the host or core already knows. The
 * Plugin pattern is an extension point inside one component; Microkernel is a whole system that
 * is a small core plus plug-ins. This is the first comparison that mixes a pattern and an
 * architecture, so every code and step ref below carries the right `kind`. Every claim was
 * checked against `src/patterns/enterprise/plugin` and `src/architectures/oo/microkernel`
 * (index.ts and all four language examples).
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "plugin-vs-microkernel",
  title: "Plugin pattern vs Microkernel architecture",
  order: 11,
  summary:
    "One extension point inside a component, or a whole system built as a small core plus plug-ins behind a versioned contract.",
  subjects: [
    { kind: "pattern", slug: "plugin" },
    { kind: "architecture", slug: "microkernel" },
  ],
  problem:
    "A product has to pick up behaviour that its own code does not contain: another export format, another region’s claim rules, another notification channel. Each new variant should arrive without editing the code that uses it. The question is how much structure that deserves: a single place where implementations can be swapped in, or a system organised around a core and the things that extend it.",
  constraints: [
    "Is the variation confined to one place in one component, or does it cut across the whole product, with several different places where behaviour can be added?",
    "Does the core have a job of its own that must keep working when a plug-in is missing, or is the host just the thing that calls whichever implementations are registered?",
    "Who writes the plug-ins, and does the interface they are written against need a version number that the host checks?",
    "Is a plain list of what to load enough, or do plug-ins need services from the core and an install step that can refuse them?",
    "Can the team carry a published contract, with every later change to it a possible break for existing plug-ins?",
  ],
  dimensions: [
    {
      label: "Scope",
      values: {
        plugin:
          "One extension point inside one component. The example has a single one, the Exporter interface, behind a PluginRegistry that the Host calls.",
        microkernel:
          "The shape of the whole system. ClaimsCore has a job of its own (processing claims) and two extension points, claim rules per region and claim listeners; everything that varies lives outside it.",
      },
    },
    {
      label: "Who owns the contract",
      values: {
        plugin:
          "A narrow interface the host side depends on: Exporter has an id and an export operation, and nothing else is on it. The host and the registry know only this interface.",
        microkernel:
          "The core publishes a larger contract: Plugin, ClaimRules, ClaimListener, the claim and decision types, and CoreApi, the core services each plug-in is handed. A plug-in is written against these and nothing else.",
      },
    },
    {
      label: "Discovery and registration",
      values: {
        plugin:
          "A manifest lists module names, and the PluginLoader looks each one up in a map of known factories and registers the result under the id the plugin reports. The plugin itself takes no part in registering; an unknown module name is an error.",
        microkernel:
          "There is no manifest and no loader in the example: the usage code calls install for each plug-in. The core then calls the plug-in’s activate with a CoreApi, and the plug-in registers its own rules or listener through it.",
      },
    },
    {
      label: "Versioning",
      values: {
        plugin:
          "None in the example: Exporter carries no version, and nothing checks one. A real host could add that, but the pattern as taught here does not include it.",
        microkernel:
          "Part of the design. The core provides contract version 2, each plug-in declares the API version it was built for, and install refuses a mismatch, so legacy-tx (built for 1) is rejected and its activate never runs.",
      },
    },
    {
      label: "When a new implementation arrives",
      values: {
        plugin:
          "At load time. The example adds a third entry to the manifest and runs the loader into a fresh PluginRegistry; Host and PluginRegistry are not edited. It does not add a plugin to a registry that is already in use.",
        microkernel:
          "Even while the core is running. The usage code installs tx-rules after three claims have been processed, and ClaimsCore is not edited or restarted.",
      },
    },
    {
      label: "Failure behaviour",
      values: {
        plugin:
          'Asking for an id that was never registered fails with an error that names the id and lists the registered ones, and so does an unknown manifest entry. The host does not fall back to anything; "pdf" is an error.',
        microkernel:
          "Designed to carry on: a version mismatch is a printed rejection and a false result, not an exception, and a claim whose region has no rules becomes a manual review. That covers a missing or refused plug-in, not a plug-in that fails while running.",
      },
    },
    {
      label: "Isolation of a misbehaving plug-in",
      values: {
        plugin:
          "Not shown. The host calls the plugin directly and does not guard the call, so what happens when a plugin’s own code fails is whatever the host language does.",
        microkernel:
          "Limited. The core calls plug-in rules and listeners directly, on its own call stack, and does not guard those calls either; the page lists a failing listener as a risk, since it affects the core’s call.",
      },
    },
    {
      label: "Cost",
      values: {
        plugin:
          "A registry and a loader, plus one interface to keep stable. Following what runs for an id means reading the manifest and the factory map.",
        microkernel:
          "A contract to design, version and keep compatible, a core that offers everything plug-ins need, and a system whose behaviour is spread across separately built parts.",
      },
    },
  ],
  options: [
    {
      subject: "plugin",
      changes:
        "The Host stops naming concrete exporters. It asks the PluginRegistry for an id and calls the Exporter it gets back, and a PluginLoader fills the registry from a manifest before the Host runs. Adding a format is a manifest entry plus the plugin’s code and a factory entry. Nothing else about the system’s shape changes.",
      chooseWhen: [
        "The variation is in one place, such as which export format or which payment provider, and the rest of the component is ordinary code.",
        "Implementations should be selected by configuration or by what is present at start-up, not by an edit to the host.",
        "A single small interface is enough: plugins do not need services handed back from the host or a version check.",
      ],
      code: [
        { kind: "pattern", slug: "plugin", region: "exporter" },
        { kind: "pattern", slug: "plugin", region: "pluginLoader" },
        { kind: "pattern", slug: "plugin", region: "host" },
      ],
      steps: [
        { kind: "pattern", slug: "plugin", step: 2 },
        { kind: "pattern", slug: "plugin", step: 4 },
        { kind: "pattern", slug: "plugin", step: 6 },
      ],
    },
    {
      subject: "microkernel",
      changes:
        "The system is organised as ClaimsCore plus plug-ins. The core does the general job and keeps the registry of extension points; each plug-in implements a published, versioned contract and receives a CoreApi when it is activated. Install checks the declared version first, so an incompatible plug-in is refused and the core carries on without it.",
      chooseWhen: [
        "A stable core job is surrounded by variation that changes more often than the core does, and it appears in several different places.",
        "Other teams or third parties build the extensions, so there is one contract to document and a version that has to be checked when they are installed.",
        "The product must keep working when a feature is not installed, and some features should be installable while it runs.",
      ],
      code: [
        { kind: "architecture", slug: "microkernel", region: "contracts" },
        { kind: "architecture", slug: "microkernel", region: "core" },
        { kind: "architecture", slug: "microkernel", region: "usage" },
      ],
      steps: [
        { kind: "architecture", slug: "microkernel", step: 3 },
        { kind: "architecture", slug: "microkernel", step: 6 },
        { kind: "architecture", slug: "microkernel", step: 7 },
      ],
    },
  ],
  noPattern: {
    when: "There are only a few implementations, they are all written by the team that owns the host, and they change together with it.",
    instead:
      "Use a plain lookup, such as a map from an id to a function or object, or a switch, inside the host. Introduce a registry, a loader or a versioned contract only when someone outside the host’s own code needs to add implementations.",
  },
  overlap:
    "The Microkernel is built from the Plugin pattern, so they are complementary and not rivals. Each of its extension points works the way the pattern teaches: the core depends on an interface, plug-ins implement it, and a registry holds what was added. The architecture adds what the pattern leaves out: a core with a job of its own, several extension points, services handed to each plug-in, and a version check at install time. The two examples differ in their wiring, too. The Plugin example has a manifest and a loader, while the Microkernel example has neither and installs plug-ins from the usage code. A single extension point behind a registry is the Plugin pattern and does not make a system a microkernel, whereas a microkernel can use the pattern at each of its extension points.",
  scenario: {
    prompt:
      "A reporting module inside a larger app has to export documents as Markdown, HTML and, later, JSON. Another team will add formats over time, and which ones are available is set in configuration. Nothing else in the module varies, and no outside party writes the formats. What should the team use?",
    choices: [
      {
        id: "plugin",
        option: "plugin",
        label: "The Plugin pattern: an exporter interface, a registry and a manifest-driven loader",
        verdict: "best",
        explanation:
          "The variation is in one place and is chosen by configuration, which is the case the pattern is for. The Host calls the registry by id and never names a concrete exporter, so a new format is a manifest entry plus its code and factory entry. A small interface is enough, so no versioned contract or install step is needed.",
      },
      {
        id: "microkernel",
        option: "microkernel",
        label:
          "Rebuild the module as a microkernel: a core, a versioned contract and installable plug-ins",
        verdict: "poor",
        explanation:
          "The Microkernel is a structure for a whole system with a core job and several extension points, and it brings a contract that must be versioned and kept compatible. One extension point inside one module does not need that. If the reporting module later grows more extension points and outside authors, that would be the time to reconsider.",
      },
      {
        id: "no-pattern",
        option: "none",
        label: "No pattern: a switch or a map from format name to function inside the module",
        verdict: "workable",
        explanation:
          "For three formats owned by one team this is simple and perfectly reasonable. It stops being enough when another team needs to add a format without editing the module, because every new format is then a change to the host’s own code, which is what the Plugin pattern avoids.",
      },
    ],
  },
};
