/**
 * Strangler Fig and Anti-Corruption Layer both appear whenever a legacy system is involved, so
 * they are easy to treat as one tool. They answer different questions: Strangler Fig is about
 * *replacing* the legacy system over time (a facade decides which system answers each request),
 * while an Anti-Corruption Layer is about *protecting* your own model from a foreign one (a
 * translation layer decides what vocabulary your code sees). Every claim below was checked
 * against `src/patterns/enterprise/strangler-fig` and
 * `src/patterns/enterprise/anti-corruption-layer` (index.ts and all four language examples),
 * not against the patterns in the abstract.
 */
import type { ComparisonDefinition } from "@/types/comparison";

export const comparison: ComparisonDefinition = {
  slug: "strangler-fig-vs-anti-corruption-layer",
  title: "Strangler Fig vs Anti-Corruption Layer",
  order: 14,
  summary:
    "Both sit in front of a legacy system. One routes features to its replacement until the old system can go; the other translates its model so yours stays clean.",
  subjects: [
    { kind: "pattern", slug: "strangler-fig" },
    { kind: "pattern", slug: "anti-corruption-layer" },
  ],
  problem:
    "A team depends on a legacy system. Its model is awkward (numeric status codes, slash-delimited dates, the occasional invalid record), and there is pressure to get off it. The team has to decide what to put at the boundary: something that moves features to a new implementation one at a time, something that translates the legacy model into the team’s own, or both.",
  constraints: [
    "Is the goal to get rid of the legacy system, or to keep using it without letting its model shape the new code?",
    "Will the legacy system still exist in a year, or is there a plan that ends with it switched off?",
    "Do clients need to keep sending the same requests while the work happens, or is the problem that your own code is being polluted by the legacy vocabulary?",
    "Does data have to move to a new store, or only be read and reshaped?",
    "Can the legacy data be trusted, or must unmapped codes and malformed values be absorbed at the boundary?",
  ],
  dimensions: [
    {
      label: "Goal",
      values: {
        "strangler-fig":
          "Replace the legacy system gradually, instead of in one big rewrite, until nothing depends on it.",
        "anti-corruption-layer":
          "Protect your own domain model from a foreign or legacy model, so its quirks do not spread inward.",
      },
    },
    {
      label: "Lifetime",
      values: {
        "strangler-fig":
          "Temporary by design: the aim is an end state where no feature is routed to the legacy system and it can be retired. The page also warns that a migration can stall half way, with both systems kept for good.",
        "anti-corruption-layer":
          "Has no end date built in. It stays for as long as your code consumes the foreign model, and nothing in the example removes it.",
      },
    },
    {
      label: "What sits at the boundary",
      values: {
        "strangler-fig":
          "Routing. StranglerFacade keeps a route table with one entry per feature and forwards each request to LegacyMonolith or ModernService.",
        "anti-corruption-layer":
          "Translation. ShippingAntiCorruptionLayer calls the legacy system, maps its status code and date string into a domain Shipment, and normalizes invalid values.",
      },
    },
    {
      label: "Data concerns",
      values: {
        "strangler-fig":
          "Data has to move with each feature. In this example a single copy step imports the legacy orders into the modern service before orders are routed there; routing orders too early gets a 404. The page explains that real migrations need dual writes, change data capture or sync jobs.",
        "anti-corruption-layer":
          "No data is moved or copied: each call reads the legacy record and translates it. The concern is the shape and trustworthiness of that data: an unmapped status code becomes Unknown and an impossible date becomes no date.",
      },
    },
    {
      label: "What happens to the legacy system",
      values: {
        "strangler-fig":
          "Its code is never edited in the example; only the share of features routed to it shrinks, from all three to none, and then the facade marks it as retired.",
        "anti-corruption-layer":
          "It stays as it is and keeps being called, and nothing in the example replaces it. The layer only keeps its model out of the domain code.",
      },
    },
    {
      label: "What clients and callers see",
      values: {
        "strangler-fig":
          "The same requests before, during and after the migration. The facade is the only thing the client knows, and the reply also says which system served it.",
        "anti-corruption-layer":
          "Only domain types. OrderTrackingService calls the layer and never sees a status code or a legacy date format.",
      },
    },
    {
      label: "Does it translate the model",
      values: {
        "strangler-fig":
          "Not in this example: it has no Anti-Corruption Layer. Both systems answer the same kind of request with the same kind of reply, and the copy step moves order records as they are.",
        "anti-corruption-layer":
          "Yes, that is its whole job. It has no routing and no replacement system in this example: it only reads from the one legacy system.",
      },
    },
  ],
  options: [
    {
      subject: "strangler-fig",
      changes:
        "StranglerFacade goes in front of both systems and every feature starts out routed to LegacyMonolith. The migrate call flips one feature at a time to ModernService, the rollback flips it back, and the retire call is refused until no feature is routed to the legacy system. Clients never change their requests.",
      chooseWhen: [
        "The legacy system really is going to be replaced, and a big-bang rewrite is too risky or takes too long.",
        "It has to keep serving its clients while that happens, and the features can be reached through one entry point that a facade can route on.",
        "You want the new system live early and checked against real traffic, with a rollback that is one call to the facade.",
      ],
      code: [
        { kind: "pattern", slug: "strangler-fig", region: "facade" },
        { kind: "pattern", slug: "strangler-fig", region: "migration" },
      ],
      steps: [
        { kind: "pattern", slug: "strangler-fig", step: 2 },
        { kind: "pattern", slug: "strangler-fig", step: 3 },
        { kind: "pattern", slug: "strangler-fig", step: 8 },
      ],
    },
    {
      subject: "anti-corruption-layer",
      changes:
        "OrderTrackingService only calls ShippingAntiCorruptionLayer. The layer calls the legacy system’s lookup, maps the numeric status and the date string into a domain Shipment, and turns an unmapped status code into Unknown and an impossible date into no date. The legacy shape never reaches the domain.",
      chooseWhen: [
        "Your domain model must consume a system you do not control, whether legacy, a vendor API or a foreign bounded context, and its model does not match yours.",
        "The upstream data cannot be fully trusted: unmapped codes, inconsistent formats or invalid records.",
        "You want one place that absorbs upstream model changes, and the upstream system may stay in use indefinitely.",
      ],
      code: [
        { kind: "pattern", slug: "anti-corruption-layer", region: "translate" },
        { kind: "pattern", slug: "anti-corruption-layer", region: "domainModel" },
      ],
      steps: [
        { kind: "pattern", slug: "anti-corruption-layer", step: 3 },
        { kind: "pattern", slug: "anti-corruption-layer", step: 7 },
      ],
    },
  ],
  noPattern: {
    when: "The legacy system is small enough to replace in a single release with an acceptable cutover, and its model is already close to your own.",
    instead:
      "For the replacement, switch over in one step instead of routing feature by feature. For the model, a plain mapping function or a simple Adapter at the call site is enough when there is nothing invalid to absorb and no model to protect.",
  },
  overlap:
    "These patterns are complementary and often used together. A strangler migration decides which system answers a request; it does not decide what vocabulary the new code sees. While the legacy system is still alive, the new side often has to read its data in the legacy shape, and an Anti-Corruption Layer keeps that shape out of the new code. The Anti-Corruption Layer page lists Strangler Fig migrations as one of its real-world uses. The Strangler Fig example here has no Anti-Corruption Layer: both systems answer the same kind of request and the copy step moves order records as they are, so nothing needs translating. Once the legacy system is retired, an Anti-Corruption Layer around it has nothing left to translate.",
  scenario: {
    prompt:
      "A team is retiring a legacy order system one feature at a time, and its clients must keep sending the same requests. The new order service will also read shipment data from a separate legacy shipping platform that stays in service and reports numeric status codes and sometimes malformed dates. What should the team put at the boundaries?",
    choices: [
      {
        id: "both",
        label:
          "Strangler Fig for the order system, and an Anti-Corruption Layer around the shipping platform",
        verdict: "best",
        explanation:
          "There are two different problems. The order system is being replaced, so a facade can route features to the new service while clients keep their requests. The shipping platform is not being replaced, so the new service needs a translation layer that turns its codes and dates into domain values and absorbs the bad records.",
      },
      {
        id: "strangler-only",
        option: "strangler-fig",
        label: "Strangler Fig alone",
        verdict: "workable",
        explanation:
          "The facade handles the order migration, and clients keep their requests. But it only routes: it does not translate. Without a layer at the shipping boundary, the status codes and date strings are read straight into the new service, and a bad record can spread into it.",
      },
      {
        id: "acl-only",
        option: "anti-corruption-layer",
        label: "Anti-Corruption Layer alone",
        verdict: "workable",
        explanation:
          "A translation layer keeps the shipping model out of the new service. But it does not move any order feature, and it gives clients no way to keep their requests while the old order system is replaced. The replacement would still be a big-bang cutover.",
      },
      {
        id: "neither",
        option: "none",
        label: "A big-bang rewrite that calls the shipping platform directly",
        verdict: "poor",
        explanation:
          "The new order service cannot go live until everything is rebuilt, a failed cutover is hard to undo, and the shipping platform’s model leaks into the new code from day one.",
      },
    ],
  },
};
