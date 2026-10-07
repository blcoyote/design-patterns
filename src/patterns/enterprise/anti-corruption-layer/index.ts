import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "anti-corruption-layer",
  name: "Anti-Corruption Layer",
  category: "enterprise",
  order: 12,
  summary:
    "Translate an external or legacy system's model into your own domain model at the boundary, so its quirks and corruption never spread inward.",
  intent:
    "Isolate a bounded context's domain model from an upstream system it does not control — a legacy system, a third-party API, or another team's bounded context — by translating at the boundary instead of letting the upstream model leak in and shape (or corrupt) the downstream design.",
  problem:
    "A clean domain model needs data from a legacy shipping system: numeric status codes with no clear meaning, slash-delimited date strings, and the occasional outright invalid record. Calling that legacy API directly from domain code means every reader of the domain model now also has to understand 1998-mainframe status codes, and a bad record upstream becomes a crash or a silent bug downstream. The domain model is only as clean as the ugliest system it talks to.",
  solution:
    "Put a translation layer at the boundary, owned by the downstream (domain) side: it calls the legacy system, converts its raw shapes into the domain's own vocabulary, and normalizes anything invalid or unmapped into a safe domain-level default rather than passing it through. The rest of the domain code only ever calls the Anti-Corruption Layer and only ever sees domain types — it is insulated from the legacy system's model, and from any future change to it, by one layer instead of by discipline at every call site.",
  analogy:
    "An interpreter at a diplomatic meeting does not just convert words from one language to the other — they also smooth over a phrase that would be rude in the second language, or flag that a term has no real equivalent and needs clarification. A plain dictionary lookup (word for word) would carry over problems a trained interpreter filters out before they reach the room.",
  whenToUse: [
    "Your domain model must consume data or events from a system you do not control — a legacy platform, a vendor API, or a foreign bounded context — and its model does not match yours.",
    "The upstream system's data is not fully trustworthy: unmapped codes, inconsistent formats, or records that are sometimes outright invalid.",
    "You want one place that absorbs upstream model changes, instead of every call site that talks to the upstream system needing to be touched when it changes.",
  ],
  pros: [
    "The domain model stays expressed purely in its own vocabulary; nothing upstream ever leaks a raw status code or format into domain logic.",
    "Invalid or unmapped upstream data is normalized to a safe default in one place, instead of crashing or silently corrupting state wherever it is read.",
    "The upstream system can change its own model, and only the Anti-Corruption Layer has to change with it — the rest of the domain does not.",
  ],
  cons: [
    "It is another layer to write and maintain, and it adds a translation step (and sometimes a network hop) that a direct call would not have.",
    "Normalizing unmapped or invalid data to a safe default can also hide a real upstream bug behind a plausible-looking domain value — monitor what the layer normalizes, don't just swallow it silently.",
    "Overkill when the upstream model is already trustworthy and close to your own — plain Adapter is enough when all you need is an interface conversion, with nothing to protect against.",
  ],
  realWorld: [
    "Eric Evans' Domain-Driven Design (the \"Blue Book\") and Vaughn Vernon's Implementing Domain-Driven Design, where the Anti-Corruption Layer sits on a context map between a downstream bounded context and an upstream one it does not control.",
    "A modern service wrapping a legacy mainframe or SOAP API behind a clean, modern interface before anything downstream is allowed to depend on it.",
    "A bounded context translating another team's domain events (and their quirks) into its own event shapes before publishing them internally.",
    "Strangler Fig migrations, where new code talks to the old system only through a translation layer while the old system is incrementally replaced underneath it.",
  ],
  related: ["adapter", "facade", "repository"],

  // Diagram (viewBox 800 × 460, x/y are box centres)
  participants: [
    {
      id: "domainModel",
      label: "Shipment",
      role: "Domain model (Target)",
      kind: "object",
      x: 420,
      y: 80,
      description:
        "The clean, domain-only value the rest of the system works with: an enum-like status (Pending, InTransit, Delivered or Unknown) and an optional estimated-delivery date. It never holds a legacy status code or a raw date string.",
    },
    {
      id: "trackingService",
      label: "OrderTrackingService",
      role: "Client (domain service)",
      kind: "client",
      x: 140,
      y: 230,
      width: 190,
      description:
        "Domain-level code that reports on an order's shipment. It only calls the Anti-Corruption Layer and only ever reads domain Shipment values — it never sees the legacy system directly.",
    },
    {
      id: "acl",
      label: "ShippingAntiCorruptionLayer",
      role: "Anti-Corruption Layer",
      kind: "class",
      x: 420,
      y: 230,
      width: 220,
      description:
        "Owned by the domain side. Calls the legacy system, maps its status codes and date strings into the domain model, and normalizes anything unmapped or malformed to a safe default instead of letting it through.",
    },
    {
      id: "legacySystem",
      label: "LegacyShippingSystem",
      role: "External system (Source)",
      kind: "class",
      x: 680,
      y: 230,
      width: 190,
      description:
        "The upstream system the team does not control: a lookup() method returning its own raw shape — a numeric status code and a slash-delimited date string, not always valid.",
    },
  ],
  relations: [
    {
      id: "client-call",
      from: "trackingService",
      to: "acl",
      type: "calls",
      label: "getShipment()",
      description:
        "The domain service calls the ACL exactly as it would call any domain-facing collaborator, unaware of the legacy system behind it.",
      code: "trackingService",
    },
    {
      id: "queries",
      from: "acl",
      to: "legacySystem",
      type: "calls",
      label: "lookup()",
      description: "The ACL calls the legacy system's own method to fetch the raw record.",
      bend: -30,
      code: "translate",
    },
    {
      id: "translates-to",
      from: "acl",
      to: "domainModel",
      type: "creates",
      label: "translates",
      description:
        "The ACL builds a domain Shipment from the raw record, mapping or normalizing every field on the way.",
      bend: 30,
      code: "translate",
    },
  ],

  // Animated scenario
  steps: [
    {
      title: "Domain service asks for a shipment",
      description:
        'OrderTrackingService calls ShippingAntiCorruptionLayer.getShipment("O-1001"). The domain service only knows the ACL\'s interface — not the legacy system behind it.',
      highlight: ["trackingService", "client-call", "acl"],
      packets: [{ relation: "client-call", label: "getShipment(O-1001)" }],
      notes: { trackingService: "asks for O-1001" },
      code: "trackingService",
    },
    {
      title: "ACL queries the legacy system",
      description:
        "getShipment() calls the legacy system's own lookup() method to fetch the raw record for this order.",
      highlight: ["acl", "queries", "legacySystem"],
      packets: [{ relation: "queries", label: "lookup(O-1001)" }],
      code: "translate",
    },
    {
      title: "Legacy system returns its own raw shape",
      description:
        "The legacy system returns its own record: a numeric status code and a slash-delimited date string — the shape a decades-old API would use.",
      highlight: ["legacySystem", "queries"],
      packets: [{ relation: "queries", label: "stat 1, eta 04/02/2025", reverse: true }],
      notes: { legacySystem: "stat 1, eta 04/02/2025" },
      code: "lookup",
    },
    {
      title: "ACL translates into the domain model",
      description:
        "translateStatus() maps the numeric code 1 to the domain's InTransit value, and parseEta() turns the date string into a real date. The legacy shape never reaches the domain.",
      highlight: ["acl", "translates-to", "domainModel"],
      packets: [{ relation: "translates-to", label: "Shipment{InTransit}" }],
      notes: { domainModel: "InTransit" },
      code: "translate",
    },
    {
      title: "Domain-only result flows back",
      description:
        "getShipment() returns a plain Shipment value. OrderTrackingService describes it without ever having seen a status code or a legacy date format.",
      highlight: ["acl", "client-call", "trackingService"],
      packets: [{ relation: "client-call", label: "InTransit, ETA 2025-04-02", reverse: true }],
      notes: { trackingService: "InTransit, ETA 2025-04-02" },
      code: "trackingService",
    },
    {
      title: "Order O-2002: ACL queries the legacy system again",
      description:
        "For a second order, getShipment() calls lookup() again — the ACL has no way to know in advance that this record is corrupt.",
      highlight: ["acl", "queries", "legacySystem"],
      packets: [{ relation: "queries", label: "lookup(O-2002)" }],
      code: "translate",
    },
    {
      title: "Legacy system returns corrupt data",
      description:
        "This time the legacy record is corrupt: an unmapped status code (9) that matches nothing in the domain, and a blank date string.",
      highlight: ["legacySystem", "queries"],
      packets: [{ relation: "queries", label: 'stat 9, eta ""', reverse: true }],
      notes: { legacySystem: 'stat 9, eta ""' },
      code: "lookup",
    },
    {
      title: "ACL normalizes the corruption to a safe default",
      description:
        "translateStatus() has no case for 9, so it falls through to Unknown instead of passing the raw code on. parseEta() cannot parse an empty string, so it returns no date instead of throwing or guessing.",
      highlight: ["acl", "translates-to", "domainModel"],
      packets: [{ relation: "translates-to", label: "Shipment{Unknown}" }],
      notes: { domainModel: "Unknown (safe default)" },
      code: "translate",
    },
    {
      title: "Domain sees a safe value — never the raw corruption",
      description:
        'OrderTrackingService reports "Unknown, ETA unknown" for O-2002. It never saw the code 9 or the blank date string — the corruption stopped at the Anti-Corruption Layer, exactly as intended.',
      highlight: ["acl", "client-call", "trackingService"],
      packets: [{ relation: "client-call", label: "Unknown, ETA unknown", reverse: true }],
      notes: { trackingService: "Unknown, ETA unknown" },
      code: "trackingService",
    },
  ],

  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
