import type { ArchitectureDefinition } from "@/types/architecture";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { MicrokernelVisualization } from "./Visualization";

export const architecture: ArchitectureDefinition = {
  slug: "microkernel",
  name: "Microkernel (Plug-in Architecture)",
  paradigm: "oo",
  order: 15,
  summary:
    "A minimal core system that stays unchanged while independently built plug-ins add features through a versioned contract and the core's registry of extension points.",
  intent:
    "Keep a small core system that does only what every user of the product needs, and let everything that varies (per region, per customer, per feature) arrive as plug-ins that are built and added separately. The core and the plug-ins meet at one versioned contract, so the core can grow new behaviour without being edited.",
  problem:
    "A system whose behaviour differs by region, customer or product edition tends to collect those differences in its core: one more branch for Texas, one more flag for a customer, one more release for everybody. The core grows, every change risks breaking an unrelated case, and a rule that only one customer needs ships and is tested with everyone. Splitting into separate applications duplicates the shared parts instead.",
  solution:
    "Split the system into a small core system and a set of plug-in components. The core keeps the general job (here, processing claims) and a registry of extension points: a map from region to claim rules, and an ordered list of claim listeners. Plug-ins implement the contract the core publishes, a versioned set of types that includes the core services (CoreApi) the core hands each plug-in while it is activated. At install time the core checks the plug-in's declared apiVersion against the version it provides and refuses a mismatch, so activate never runs. The core never names a plug-in class and plug-ins never reference each other, so a plug-in can be added, replaced or missing without editing the core, and with a plug-in missing the core still works: a claim without rules for its region becomes a manual review, not a failure. In this one-file demo the plug-ins are compiled in and the usage code decides what to install; in a real product they ship as separate packages that the host discovers.",
  analogy:
    "A power drill with interchangeable bits. The drill is the core: it turns, it has a trigger and a chuck, and it does that one job well. Each bit is a plug-in built to the chuck's standard, so a new bit works on an old drill without anyone opening the drill. A bit made for an older, incompatible chuck is refused at the door instead of snapping off halfway through a hole.",
  whenToUse: [
    "A stable core job (processing claims, editing text, building software) is surrounded by variation that changes more often than the core does.",
    "Different customers, regions or editions need different behaviour, and you want each variant built, tested and shipped without touching the core.",
    "Third parties or other teams should be able to extend the product, and you want one contract to version and document for them.",
    "The product should keep working when a feature is not installed, and new features should be installable without redeploying the core (where the platform allows it).",
  ],
  pros: [
    "The core stays small and stable: new behaviour is added as a plug-in, so the core is not edited, and its tests are not disturbed, for every new region or feature.",
    "Plug-ins can be built, tested and released independently of the core and of each other; one plug-in does not need to know another exists.",
    "The core keeps working when a plug-in is missing: in this example TX claims go to manual review until tx-rules is installed.",
    "A versioned contract checked at install time turns an incompatible plug-in into a clear rejection (rejected legacy-tx: needs core API 1, core provides 2) instead of a failure in the middle of work.",
  ],
  cons: [
    "The contract is the hard part. Once plug-ins exist, every change to it can break them, so it has to be small, versioned and changed with care; getting it wrong early is expensive.",
    "Everything a plug-in needs from the core must be offered through the contract. If it is missing, plug-ins either cannot do the job or tempt the core into leaking internals.",
    "Plug-ins can interact in ways nobody planned: here two plug-ins registering rules for the same region would silently replace one another (the later registration wins), and a listener that fails affects the core's call, because listeners run synchronously on its call stack.",
    "The behaviour of the whole system is spread over many separately released parts, so it is harder to see, test and reason about what is running than in one program, and plug-in versions have to be managed.",
  ],
  realWorld: [
    "VS Code is a small editor core whose features largely arrive as extensions. Each extension has a manifest that declares its contribution points, and an engines.vscode field naming the editor versions it works with.",
    "Eclipse is built on OSGi bundles: the platform is a small runtime, and its tools are plug-ins that extend it through declared extension points.",
    "Jenkins is a core build server whose capabilities (source control, build steps, notifications) come from plug-ins that extend it through the core's extension points.",
    "Web browsers let people install extensions that add features through the extension APIs the browser exposes, without changing the browser itself.",
    "Richards and Ford, in Fundamentals of Software Architecture, use insurance claims processing as their own example: a general processing core, with the rules that differ between jurisdictions kept in plug-in components.",
  ],
  concepts: [
    {
      term: "Core system",
      description:
        "The minimal part that has to exist for the product to do its basic job, here ClaimsCore, which processes claims. It contains nothing that is specific to one region, and it never names a plug-in class; it knows only the contract.",
    },
    {
      term: "Plug-in",
      description:
        "A separately built component that adds or changes behaviour through the contract: ca-rules, ny-rules and tx-rules supply claim rules for one region each, and audit-log adds a listener. A plug-in has an id and the contract version it was built for, and it never references another plug-in. Here a plug-in is a class in every language (a struct in Go).",
    },
    {
      term: "Plug-in contract (versioned)",
      description:
        "Everything a plug-in is allowed to see: the Plugin interface, ClaimRules, the claim and decision types, and CoreApi. It carries a version number, and the core compares it with each plug-in's declared apiVersion at install time and rejects a mismatch.",
    },
    {
      term: "Registry / extension point",
      description:
        "Where the core keeps what plug-ins contribute, and the places the core lets them contribute to. Here there are two extension points inside ClaimsCore: a map from region to ClaimRules, and an ordered list of claim listeners. Plug-ins reach them only through CoreApi; the registry itself is private to the core.",
    },
    {
      term: "Core services (CoreApi)",
      description:
        "What the core hands a plug-in during activate: registerClaimRules, addClaimListener and log. Each plug-in gets its own CoreApi, so the core can record what that plug-in contributed and tag its log lines with the plug-in id.",
    },
    {
      term: "Runtime installation",
      description:
        "Adding a plug-in to a core that is already running. Here usage installs tx-rules after three claims have been processed, and the core's code is unchanged. In this demo the plug-in class is still compiled into the same program; a real platform loads it from a separate package.",
    },
  ],
  variants: [
    {
      name: "Point-to-point vs remote plug-ins",
      description:
        "The core can call a plug-in in the same process through its interface, as this example does, or reach it over REST or messaging, so the plug-in runs as a separate service. Remote plug-ins can be written and deployed on their own, but the contract then has to cope with network failure and latency.",
    },
    {
      name: "Static vs dynamic plug-in loading",
      description:
        "Plug-ins can be fixed at build or start-up time, or discovered and loaded while the core runs, as OSGi bundles and editor extensions are. This example installs tx-rules while running, but its plug-in classes are all compiled in, so it shows the install step and not the loading from separate packages.",
    },
    {
      name: "Plug-ins with their own data",
      description:
        "A plug-in can bring its own storage (a table, a schema, a file) instead of only logic, which makes it more independent and more costly to install and upgrade. The plug-ins in this example keep no data of their own.",
    },
  ],

  commonlyUsedWith: {
    designPatterns: [
      {
        slug: "plugin",
        why: "The Plugin pattern page teaches the class-level mechanism: one extension point (an Exporter), a registry and a loader that reads a manifest. This page is the whole-system shape built around that idea. Here the core has a job of its own (processing claims) and two extension points (claim rules per region and claim listeners). It also checks a versioned contract at install time (legacy-tx is rejected), hands plug-ins a CoreApi, and keeps working with a plug-in missing (TX goes to manual review). There is no manifest or loader: the usage code installs the plug-ins directly.",
      },
      {
        slug: "strategy",
        why: "ClaimRules is the strategy interface. For each claim, ClaimsCore looks up the rules registered for the claim's region and calls assess, so the 500.00 deductible of ca-rules, the 2000.00 cap of ny-rules and the 250.00 deductible of tx-rules are interchangeable algorithms chosen by region, and the core never contains any of them.",
      },
      {
        slug: "observer",
        why: "ClaimListener is the observer side: ClaimsCore keeps an ordered list of listeners and, after each decision, calls every one with that decision. audit-log is a concrete observer that logs claim-1 CA approved and so on, and the core does not know what a listener does. Here the notification is synchronous and in-process, and it iterates a snapshot of the list, so a listener added during notification first hears the next decision.",
      },
      {
        slug: "dependency-injection",
        why: "During install the core builds a CoreApi for each plug-in and passes it into activate, so a plug-in receives the core services it uses (registerClaimRules, addClaimListener, log) from outside and never constructs or looks them up itself; audit-log logs through the core's log service. The injection is through a method parameter, not a constructor.",
      },
    ],
    architectures: [
      {
        slug: "modular-monolith",
        why: "Both keep one process and let the parts meet only at a published contract: Plugin, CoreApi and ClaimRules here, the module APIs there. The shape differs. ClaimsCore is a core with a job of its own and plug-ins extend it through a registry of extension points, with an apiVersion check at install time and no plug-in referencing another, where Catalog, Ordering and Shipping are peer modules with private data that ModuleHost starts. A module could use the Microkernel shape inside to take regional variation as plug-ins.",
      },
      {
        slug: "hexagonal",
        why: "Both keep the core ignorant of what is outside it: ClaimsCore names no plug-in class, as the hexagon names no adapter. ClaimRules is an interface the core owns and calls, like a driven port, and CoreApi is what plug-ins call back into. The plug-ins differ from adapters: ca-rules, ny-rules and tx-rules add business rules instead of connecting a technology, the core checks their apiVersion, and tx-rules is installed while the core is already running, where Hexagonal wires adapters at composition time.",
      },
      {
        slug: "event-driven",
        why: "The listener extension point is event-driven in miniature: audit-log registers with addClaimListener, and ClaimsCore calls every listener with each decision without knowing what it does, as EventBroker's consumers are reached without the producer knowing them. There is no broker, topic or queue, though: listeners run synchronously on the core's call stack, from a snapshot of the list, so a failing listener affects process. The other extension point, claim rules per region, is a lookup, not an event.",
      },
    ],
  },

  viewBox: "0 0 1140 740",
  participants: [
    {
      id: "client",
      label: "Claims desk",
      role: "Client",
      kind: "client",
      x: 85,
      y: 150,
      width: 130,
      description:
        "The caller outside the system: it submits a claim with process(claim) and gets a decision back, and it never sees a plug-in. In this example the usage code plays this role and also the composition root that decides which plug-ins to install; the diagram shows the first role.",
      code: "usage",
    },
    {
      id: "core",
      label: "ClaimsCore",
      role: "Core system",
      kind: "class",
      x: 400,
      y: 150,
      width: 190,
      description:
        "The core system. Its own job is processing claims: install checks a plug-in's apiVersion and activates it with a CoreApi, and process looks up the rules for the claim's region, builds a decision and notifies every listener. It contains nothing region-specific and never names a plug-in class; it knows only the contract.",
      patterns: ["dependency-injection"],
      code: "core",
    },
    {
      id: "registry",
      label: "Extension registry",
      role: "Registry",
      kind: "object",
      x: 400,
      y: 330,
      width: 190,
      description:
        "Two extension points inside the core: a map from region to ClaimRules (a Map, Dictionary, dict or map, depending on the language) and an ordered list of claim listeners. Registering rules for a region that already has some replaces them. Plug-ins reach it only through CoreApi, never directly.",
      patterns: ["strategy"],
      code: "core",
    },
    {
      id: "contract",
      label: "Plugin contract",
      role: "Versioned contract, API v2",
      kind: "interface",
      x: 650,
      y: 330,
      width: 200,
      description:
        "Everything a plug-in may see: Plugin (id, apiVersion, activate), CoreApi, ClaimRules, ClaimListener and the claim and decision types, versioned by a constant that is 2 in this core. The core compares it with each plug-in's apiVersion at install time, so a plug-in built for version 1 is refused.",
      patterns: ["plugin"],
      code: "contracts",
    },
    {
      id: "auditLog",
      label: "audit-log",
      role: "Plug-in: listener",
      kind: "class",
      x: 920,
      y: 150,
      width: 150,
      description:
        "A plug-in for the other extension point. Its activate adds a claim listener, and the listener logs each decision through the core's log service, which tags the line with the plug-in id: [audit-log] claim-1 CA approved. Built for API version 2.",
      patterns: ["observer"],
      code: "auditLog",
    },
    {
      id: "caRules",
      label: "ca-rules",
      role: "Plug-in: claim rules",
      kind: "class",
      x: 920,
      y: 270,
      width: 150,
      description:
        "Claim rules for California: the payout is the amount minus a 500.00 deductible, never below zero. Its activate registers them for CA. The rules are an object literal in TypeScript, a private nested sealed class in C#, a small private class in Python and a ClaimRulesFunc function adapter in Go. Built for API version 2.",
      code: "caRules",
    },
    {
      id: "nyRules",
      label: "ny-rules",
      role: "Plug-in: claim rules",
      kind: "class",
      x: 920,
      y: 510,
      width: 150,
      description:
        "Claim rules for New York: the payout is the amount, capped at 2000.00. Its activate registers them for NY. Built for API version 2.",
      code: "nyRules",
    },
    {
      id: "txRules",
      label: "tx-rules",
      role: "Plug-in: claim rules",
      kind: "class",
      x: 920,
      y: 630,
      width: 150,
      description:
        "Claim rules for Texas, rebuilt for the current contract: a 250.00 deductible. It is installed at runtime, after TX claims have already gone to manual review, and the core is not edited. Built for API version 2.",
      code: "txRules",
    },
    {
      id: "legacyTx",
      label: "legacy-tx (API v1)",
      role: "Plug-in: rejected",
      kind: "class",
      x: 920,
      y: 390,
      width: 170,
      description:
        "An older Texas plug-in, built for contract version 1. The core refuses it at install time: it prints the rejection and returns false, without throwing, so its activate never runs and it registers nothing.",
      code: "legacyTx",
    },
  ],
  relations: [
    {
      id: "processClaim",
      from: "client",
      to: "core",
      type: "calls",
      label: "process(claim)",
      description:
        "The claims desk hands the core a claim. The decision comes back as a normal result: approved with a payout, or a manual review with a reason.",
      code: "core",
    },
    {
      id: "checkVersion",
      from: "core",
      to: "contract",
      type: "calls",
      label: "install: check apiVersion",
      bend: 40,
      description:
        "install compares the plug-in's apiVersion with the version the core provides. A mismatch is a printed rejection and a false result; only a match goes on to activate.",
      code: "core",
    },
    {
      id: "activateAudit",
      from: "contract",
      to: "auditLog",
      type: "calls",
      description:
        "After the version check the core calls the plug-in's activate and passes it a CoreApi. audit-log calls addClaimListener on it, and the core appends the listener to its ordered list.",
      code: "auditLog",
    },
    {
      id: "activateCa",
      from: "contract",
      to: "caRules",
      type: "calls",
      description:
        "The core activates ca-rules the same way. ca-rules calls registerClaimRules for CA on the CoreApi it was handed, and the core stores the rules in its registry.",
      code: "caRules",
    },
    {
      id: "activateNy",
      from: "contract",
      to: "nyRules",
      type: "calls",
      description:
        "The core activates ny-rules the same way. ny-rules calls registerClaimRules for NY on the CoreApi it was handed, and the core stores the rules in its registry.",
      code: "nyRules",
    },
    {
      id: "activateTx",
      from: "contract",
      to: "txRules",
      type: "calls",
      description:
        "When tx-rules is installed later, the core activates it like any other plug-in, and tx-rules registers its rules for TX through the CoreApi.",
      code: "txRules",
    },
    {
      id: "activateLegacy",
      from: "contract",
      to: "legacyTx",
      type: "calls",
      description:
        "This call never happens: the version check fails first, so legacy-tx is never activated.",
      code: "legacyTx",
    },
    {
      id: "lookup",
      from: "core",
      to: "registry",
      type: "calls",
      label: "lookup region",
      bend: 30,
      description:
        "To process a claim the core looks up the rules registered for the claim's region. If there are none, the claim becomes a manual review.",
      code: "core",
    },
    {
      id: "assessCa",
      from: "registry",
      to: "caRules",
      type: "calls",
      label: "assess(claim)",
      bend: -30,
      description: "The rules found for CA are asked for the payout of a CA claim.",
      code: "caRules",
    },
    {
      id: "assessNy",
      from: "registry",
      to: "nyRules",
      type: "calls",
      label: "assess(claim)",
      description: "The rules found for NY are asked for the payout of a NY claim.",
      code: "nyRules",
    },
    {
      id: "assessTx",
      from: "registry",
      to: "txRules",
      type: "calls",
      label: "assess(claim)",
      description: "Once registered, the rules for TX are asked for the payout of a TX claim.",
      code: "txRules",
    },
    {
      id: "notifyAudit",
      from: "core",
      to: "auditLog",
      type: "notifies",
      label: "notify(decision)",
      bend: 30,
      description:
        "After building the decision, the core calls every registered listener with it, in registration order. It does not know what a listener does.",
      code: "core",
    },
  ],

  steps: [
    {
      title: "A minimal core with plug-ins outside",
      description:
        "ClaimsCore does one job, processing claims, and holds a registry of extension points. Everything that differs by region or feature lives in plug-ins, which meet the core only at a versioned contract. This core provides contract version 2.",
      highlight: [
        "client",
        "core",
        "registry",
        "contract",
        "auditLog",
        "caRules",
        "nyRules",
        "txRules",
        "legacyTx",
      ],
      notes: { contract: "core provides API v2" },
    },
    {
      title: "ca-rules installs",
      description:
        'install checks that ca-rules was built for API version 2, which matches, so it builds a CoreApi for the plug-in and calls activate. ca-rules calls registerClaimRules for CA on the CoreApi it was handed, the core records the rules in its registry, and it prints "[core] loaded ca-rules (claim rules: CA)".',
      highlight: ["core", "checkVersion", "contract", "activateCa", "caRules", "registry"],
      packets: [
        { relation: "checkVersion", label: "ca-rules: API 2 = 2" },
        { relation: "activateCa", label: "activate(core)", after: 0 },
        { relation: "activateCa", label: "registerClaimRules(CA)", reverse: true, after: 1 },
      ],
      notes: { core: "loaded ca-rules", registry: "CA → ca-rules" },
      code: "core",
    },
    {
      title: "ny-rules and audit-log install the same way",
      description:
        'Both are built for API version 2. ny-rules calls registerClaimRules for NY and audit-log calls addClaimListener, both on the CoreApi each was handed (two extension points), and the core records both in its registry and prints "[core] loaded ny-rules (claim rules: NY)" and "[core] loaded audit-log (claim listener)". Neither plug-in knows the other exists.',
      highlight: [
        "core",
        "checkVersion",
        "contract",
        "activateNy",
        "nyRules",
        "activateAudit",
        "auditLog",
        "registry",
      ],
      packets: [
        { relation: "checkVersion", label: "ny-rules: API 2 = 2" },
        { relation: "activateNy", label: "activate(core)", after: 0 },
        { relation: "activateNy", label: "registerClaimRules(NY)", reverse: true, after: 1 },
        { relation: "activateAudit", label: "activate(core)", after: 2 },
        { relation: "activateAudit", label: "addClaimListener", reverse: true, after: 3 },
      ],
      notes: { registry: "NY → ny-rules; 1 listener", auditLog: "claim listener" },
      code: "core",
    },
    {
      title: "legacy-tx is rejected",
      description:
        'legacy-tx was built for API version 1, but the core provides version 2. install prints "[core] rejected legacy-tx: needs core API 1, core provides 2" and returns false, without throwing. Its activate never runs, so nothing is registered and the core is unchanged.',
      highlight: ["core", "checkVersion", "contract", "legacyTx"],
      packets: [{ relation: "checkVersion", label: "legacy-tx: API 1 ≠ 2" }],
      notes: {
        legacyTx: "rejected: needs API 1",
        registry: "rules: CA, NY (no TX)",
      },
      code: "core",
    },
    {
      title: "claim-1: California, 1500.00",
      description:
        'The core looks up CA, and ca-rules\' assess applies the 500.00 deductible, so the payout is 1000.00. The core then notifies its listeners: audit-log logs "[audit-log] claim-1 CA approved" through the core\'s log service, and the desk prints "claim-1: approved, payout 1000.00".',
      highlight: [
        "client",
        "processClaim",
        "core",
        "lookup",
        "registry",
        "assessCa",
        "caRules",
        "notifyAudit",
        "auditLog",
      ],
      packets: [
        { relation: "processClaim", label: "process(claim-1, CA, 1500.00)" },
        { relation: "lookup", label: "lookup CA", after: 0 },
        { relation: "assessCa", label: "assess(claim)", after: 1 },
        { relation: "assessCa", label: "1000.00", reverse: true, after: 2 },
        { relation: "notifyAudit", label: "notify(decision)", after: 3 },
        { relation: "processClaim", label: "approved, 1000.00", reverse: true, after: 4 },
      ],
      notes: { caRules: "1500.00 - 500.00", auditLog: "claim-1 CA approved" },
      code: "core",
    },
    {
      title: "claim-2: New York, 3500.00",
      description:
        'The rules for NY are looked up and ny-rules\' assess caps the payout at 2000.00. audit-log logs "[audit-log] claim-2 NY approved", and the desk prints "claim-2: approved, payout 2000.00".',
      highlight: [
        "client",
        "processClaim",
        "core",
        "lookup",
        "registry",
        "assessNy",
        "nyRules",
        "notifyAudit",
        "auditLog",
      ],
      packets: [
        { relation: "processClaim", label: "process(claim-2, NY, 3500.00)" },
        { relation: "lookup", label: "lookup NY", after: 0 },
        { relation: "assessNy", label: "assess(claim)", after: 1 },
        { relation: "assessNy", label: "2000.00", reverse: true, after: 2 },
        { relation: "notifyAudit", label: "notify(decision)", after: 3 },
        { relation: "processClaim", label: "approved, 2000.00", reverse: true, after: 4 },
      ],
      notes: { nyRules: "capped at 2000.00", auditLog: "claim-2 NY approved" },
      code: "core",
    },
    {
      title: "claim-3: Texas has no rules yet",
      description:
        'Nothing is registered for TX, because legacy-tx was refused. The core does not fail: it makes a manual review decision with the reason "no rules for TX" and a payout of 0, still notifies its listeners ("[audit-log] claim-3 TX manual review"), and the desk prints "claim-3: manual review, no rules for TX". The core keeps working with a plug-in missing.',
      highlight: [
        "client",
        "processClaim",
        "core",
        "lookup",
        "registry",
        "notifyAudit",
        "auditLog",
      ],
      packets: [
        { relation: "processClaim", label: "process(claim-3, TX, 800.00)" },
        { relation: "lookup", label: "lookup TX", after: 0 },
        { relation: "lookup", label: "no rules for TX", reverse: true, after: 1 },
        { relation: "notifyAudit", label: "notify(decision)", after: 2 },
        { relation: "processClaim", label: "manual review", reverse: true, after: 3 },
      ],
      notes: { registry: "no rules for TX", auditLog: "claim-3 TX manual review" },
      code: "core",
    },
    {
      title: "tx-rules installs at runtime",
      description:
        'The usage code installs tx-rules, built for API version 2, while the core is already running. Its activate calls registerClaimRules for TX (a 250.00 deductible) on the CoreApi, the core records the rules in its registry, and the core prints "[core] loaded tx-rules (claim rules: TX)". ClaimsCore is not edited or restarted.',
      highlight: ["core", "checkVersion", "contract", "activateTx", "txRules", "registry"],
      packets: [
        { relation: "checkVersion", label: "tx-rules: API 2 = 2" },
        { relation: "activateTx", label: "activate(core)", after: 0 },
        { relation: "activateTx", label: "registerClaimRules(TX)", reverse: true, after: 1 },
      ],
      notes: { core: "loaded tx-rules", registry: "TX → tx-rules" },
      code: "txRules",
    },
    {
      title: "claim-3 again: now approved",
      description:
        'The same TX claim for 800.00 now finds rules. tx-rules\' assess applies the 250.00 deductible, so the payout is 550.00; audit-log logs "[audit-log] claim-3 TX approved" and the desk prints "claim-3: approved, payout 550.00".',
      highlight: [
        "client",
        "processClaim",
        "core",
        "lookup",
        "registry",
        "assessTx",
        "txRules",
        "notifyAudit",
        "auditLog",
      ],
      packets: [
        { relation: "processClaim", label: "process(claim-3, TX, 800.00)" },
        { relation: "lookup", label: "lookup TX", after: 0 },
        { relation: "assessTx", label: "assess(claim)", after: 1 },
        { relation: "assessTx", label: "550.00", reverse: true, after: 2 },
        { relation: "notifyAudit", label: "notify(decision)", after: 3 },
        { relation: "processClaim", label: "approved, 550.00", reverse: true, after: 4 },
      ],
      notes: { txRules: "800.00 - 250.00", auditLog: "claim-3 TX approved" },
      code: "core",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: MicrokernelVisualization,
};
