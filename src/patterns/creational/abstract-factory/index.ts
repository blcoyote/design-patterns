import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "abstract-factory",
  name: "Abstract Factory",
  category: "creational",
  order: 4,
  summary: "Produce families of related objects without specifying their concrete classes.",
  intent:
    "Create whole families of matching objects through one interface, without naming their concrete classes.",
  problem:
    "Your UI needs buttons and checkboxes that always match the active theme, light or dark. If `new LightButton()` and `new DarkCheckbox()` are scattered across the app, nothing stops a light button from ending up next to a dark checkbox. Adding a third theme means hunting down every one of those call sites.",
  solution:
    "Define an abstract factory (UIFactory) with one creation method per product: createButton() and createCheckbox(). Then write one concrete factory per family (LightFactory, DarkFactory). Client code only knows the abstract factory and the abstract products (Button, Checkbox). Swap LightFactory for DarkFactory and every product changes at once, and they always come from the same matching family.",
  analogy:
    'Think of a furniture catalogue sold in matching sets. Pick the "Scandinavian" catalogue and every chair, table and lamp you order comes in that style. Pick "Industrial" and the whole set changes together, so you can never end up with a Scandinavian chair next to an Industrial lamp.',
  whenToUse: [
    "Your system works with several families of related products, and products from one family must never be mixed with another.",
    "You want client code to stay independent of how its objects are created and put together.",
    "You ship a library of products but want to expose only their interfaces, never the concrete classes behind them.",
  ],
  pros: [
    "Products from one factory are guaranteed to fit together.",
    "Client code never depends on concrete classes. It only uses interfaces and factories.",
    "Open/Closed: add a whole new product family by adding one new concrete factory, without changing client code.",
  ],
  cons: [
    "Adding a new kind of product (say, a Slider) means changing the abstract factory interface and every concrete factory.",
    "You get many interfaces and classes, which can be heavy when you only have a few simple objects.",
  ],
  realWorld: [
    "ADO.NET's DbProviderFactory, which creates a matching Connection, Command and Parameter for one database provider",
    "Cross-platform UI toolkits whose look-and-feel setting (e.g. Java Swing's UIManager) swaps a whole family of widgets at once",
    "Multi-cloud abstraction layers that hand you a matching set of storage, queue and secrets clients for whichever provider is configured",
  ],
  related: ["factory-method", "builder", "singleton", "bridge", "prototype"],
  participants: [
    {
      id: "uiFactory",
      label: "UIFactory",
      role: "Abstract Factory",
      kind: "interface",
      x: 400,
      y: 70,
      description:
        "Declares one creation method per product in the family — createButton() and createCheckbox() — without saying which concrete classes come back.",
    },
    {
      id: "lightFactory",
      label: "LightFactory",
      role: "Concrete Factory",
      kind: "class",
      x: 120,
      y: 200,
      description:
        "Implements UIFactory for the light theme: every product it creates is the light-themed variant.",
    },
    {
      id: "darkFactory",
      label: "DarkFactory",
      role: "Concrete Factory",
      kind: "class",
      x: 680,
      y: 200,
      description:
        "Implements UIFactory for the dark theme: every product it creates is the dark-themed variant.",
    },
    {
      id: "button",
      label: "Button",
      role: "Abstract Product A",
      kind: "interface",
      x: 400,
      y: 200,
      description:
        "The abstract product every button variant must implement. Client code only ever calls render() through this interface.",
    },
    {
      id: "checkbox",
      label: "Checkbox",
      role: "Abstract Product B",
      kind: "interface",
      x: 400,
      y: 350,
      description:
        "The abstract product every checkbox variant must implement, kept separate from Button so each creation method can vary independently.",
    },
    {
      id: "client",
      label: "Application",
      role: "Client",
      kind: "client",
      x: 660,
      y: 70,
      description:
        "Holds a single UIFactory reference — never a concrete LightFactory or DarkFactory — and builds its whole UI through createButton()/createCheckbox().",
    },
  ],
  relations: [
    {
      id: "lf-impl",
      from: "lightFactory",
      to: "uiFactory",
      type: "implements",
      description:
        "LightFactory implements the UIFactory interface, committing to build light-themed products.",
    },
    {
      id: "df-impl",
      from: "darkFactory",
      to: "uiFactory",
      type: "implements",
      description:
        "DarkFactory implements the UIFactory interface, committing to build dark-themed products.",
    },
    {
      id: "lf-creates-button",
      from: "lightFactory",
      to: "button",
      type: "creates",
      label: "createButton()",
      description: "LightFactory.createButton() returns a new LightButton.",
      code: "lightFactory",
    },
    {
      id: "lf-creates-checkbox",
      from: "lightFactory",
      to: "checkbox",
      type: "creates",
      label: "createCheckbox()",
      description: "LightFactory.createCheckbox() returns a new LightCheckbox.",
      code: "lightFactory",
    },
    {
      id: "df-creates-button",
      from: "darkFactory",
      to: "button",
      type: "creates",
      label: "createButton()",
      description: "DarkFactory.createButton() returns a new DarkButton.",
      code: "darkFactory",
    },
    {
      id: "df-creates-checkbox",
      from: "darkFactory",
      to: "checkbox",
      type: "creates",
      label: "createCheckbox()",
      description: "DarkFactory.createCheckbox() returns a new DarkCheckbox.",
      code: "darkFactory",
    },
    {
      id: "client-calls",
      from: "client",
      to: "uiFactory",
      type: "calls",
      bend: 30,
      label: "createButton() / createCheckbox()",
      description:
        "The client calls createButton()/createCheckbox() on whichever UIFactory it was handed — never on a concrete factory class.",
      code: "usage",
    },
  ],
  steps: [
    {
      title: "One interface, two families",
      description:
        "UIFactory declares createButton() and createCheckbox(). LightFactory and DarkFactory each implement it, promising a matching Button and Checkbox for their own theme.",
      highlight: ["uiFactory", "lightFactory", "darkFactory", "lf-impl", "df-impl"],
      code: "uiFactory",
    },
    {
      title: "App reads the active theme",
      description:
        "At startup the application checks the user's theme preference and decides to go with the dark one — but from here on it only ever holds the result as a UIFactory.",
      highlight: ["client", "darkFactory"],
      notes: { client: "theme: dark" },
      code: "usage",
    },
    {
      title: "Factory builds the button",
      description:
        "The client calls createButton() on its factory reference. Because that reference is really a DarkFactory, it gets back a DarkButton — without ever writing `new DarkButton()` itself.",
      highlight: ["client", "client-calls", "darkFactory", "df-creates-button", "button"],
      packets: [
        { relation: "client-calls", label: "createButton()" },
        { relation: "df-creates-button", label: "new DarkButton()", after: 0 },
      ],
      notes: { button: "dark variant" },
      code: "darkFactory",
    },
    {
      title: "Factory builds the checkbox",
      description:
        "The same call pattern produces the other half of the family: createCheckbox() resolves to DarkFactory's implementation and returns a DarkCheckbox, so the two widgets automatically match.",
      highlight: ["client", "client-calls", "darkFactory", "df-creates-checkbox", "checkbox"],
      packets: [
        { relation: "client-calls", label: "createCheckbox()" },
        {
          relation: "df-creates-checkbox",
          label: "new DarkCheckbox()",
          after: 0,
        },
      ],
      notes: { checkbox: "dark variant" },
      code: "darkFactory",
    },
    {
      title: "Render through the interfaces only",
      description:
        "The client renders both widgets by calling render() on the Button and Checkbox it received. It never imports DarkButton or DarkCheckbox — only the abstract product types.",
      highlight: ["client", "button", "checkbox"],
      notes: { button: "rendered", checkbox: "rendered" },
      code: "usage",
    },
    {
      title: "Swap the whole family",
      description:
        "Later the user switches to light mode. The app constructs a LightFactory instead, and every widget built from this point on is the matching light-themed variant — the rendering code above never changes.",
      highlight: [
        "client",
        "lightFactory",
        "lf-creates-button",
        "lf-creates-checkbox",
        "button",
        "checkbox",
      ],
      packets: [
        { relation: "lf-creates-button", label: "new LightButton()" },
        { relation: "lf-creates-checkbox", label: "new LightCheckbox()", after: 0 },
      ],
      notes: { button: "light variant", checkbox: "light variant" },
      code: "lightFactory",
    },
    {
      title: "Families can't be mixed",
      description:
        "Because each concrete factory only ever returns its own matching products, there is no code path that pairs a DarkButton with a LightCheckbox — as long as the client builds from one factory, consistency is enforced by construction, not by convention.",
      highlight: ["uiFactory", "lightFactory", "darkFactory"],
      code: "uiFactory",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
