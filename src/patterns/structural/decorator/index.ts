import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";
import { DecoratorVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "decorator",
  name: "Decorator",
  category: "structural",
  order: 2,
  summary: "Attach new behaviour to an object by wrapping it, layer by layer.",
  intent:
    "Add behavior to an object by wrapping it in another object with the same interface, rather than creating a type for every feature combination.",
  problem:
    "A coffee shop sells a base coffee, but customers can add milk, sugar, whipped cream, or any mix of them, in any order. If a class-based design subclasses every combination (MilkCoffee, MilkSugarCoffee, SugarWhipCoffee and so on), the number of types explodes, and each combination is fixed at compile time. Go has the same combinatorial problem even though it uses structs and embedding rather than class inheritance.",
  solution:
    "Give each decorator the same interface as the object it wraps. A decorator adds its behavior, then passes the call to the wrapped object. You can stack decorators at runtime in any order. Unlike a Proxy, a decorator wraps an object it is given and adds behavior; a Proxy controls access to the object it represents and often creates it itself.",
  analogy:
    "Think of dressing for cold weather: a shirt, then a sweater over it, then a coat over that. Each layer adds warmth without changing the layers underneath, and you can put on or take off exactly the layers you need.",
  whenToUse: [
    "You need to add responsibilities to individual objects, not to every instance of a class.",
    "Static types for every combination of features would multiply quickly.",
    "You want to add or remove behaviour at runtime instead of at compile time.",
  ],
  pros: [
    "It is more flexible than static inheritance or embedding, because you combine behaviors at runtime.",
    "You avoid a class for every combination.",
    "Single Responsibility: each decorator handles one concern.",
  ],
  cons: [
    "Many small objects that look alike can be hard to debug.",
    "The order of wrapping matters and is easy to get wrong.",
    "Removing one specific decorator from the middle of a stack is awkward.",
  ],
  realWorld: [
    "Java I/O: BufferedInputStream wrapping a FileInputStream to add buffering",
    ".NET streams: GZipStream or BufferedStream wrapping any Stream to add compression or buffering",
    "UI component libraries that wrap a component to add tooltip, draggable or resizable behaviour",
    "HTTP middleware chains that wrap a request handler",
  ],
  related: ["adapter", "composite", "facade", "proxy", "strategy"],
  participants: [
    {
      id: "coffee",
      label: "Coffee",
      role: "Component interface",
      kind: "interface",
      x: 400,
      y: 70,
      description:
        "Declares cost() and description(), implemented by both the base coffee and every decorator.",
    },
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 660,
      y: 150,
      description:
        "Builds a stack of decorators around a base coffee, then calls cost() on the outermost one.",
    },
    {
      id: "sugarDecorator",
      label: "SugarDecorator",
      role: "Concrete Decorator",
      kind: "class",
      x: 560,
      y: 260,
      description: 'Adds $0.25 to the wrapped cost and "+ sugar" to the description, then returns.',
    },
    {
      id: "milkDecorator",
      label: "MilkDecorator",
      role: "Concrete Decorator",
      kind: "class",
      x: 350,
      y: 260,
      description: 'Adds $0.50 to the wrapped cost and "+ milk" to the description, then returns.',
    },
    {
      id: "simpleCoffee",
      label: "SimpleCoffee",
      role: "Concrete Component",
      kind: "class",
      x: 150,
      y: 260,
      description: "The base object being decorated: a plain $2.00 coffee with no add-ons.",
    },
    {
      id: "coffeeDecorator",
      label: "CoffeeDecorator",
      role: "Base Decorator",
      kind: "class",
      x: 450,
      y: 380,
      width: 170,
      description:
        "Class-based tabs use an abstract base that implements Coffee and stores the wrapped instance. Go uses a concrete forwarding struct embedded by MilkDecorator and SugarDecorator.",
    },
  ],
  relations: [
    {
      id: "call",
      from: "client",
      to: "sugarDecorator",
      type: "calls",
      label: "cost()",
      description:
        "The client only ever calls cost() on the outermost layer — it has no idea how many layers are underneath.",
      code: "usage",
    },
    {
      id: "wrapsMilk",
      from: "sugarDecorator",
      to: "milkDecorator",
      type: "wraps",
      label: "wraps",
      description: "SugarDecorator was constructed around the MilkDecorator instance.",
      code: "sugarDecorator",
    },
    {
      id: "wrapsCoffee",
      from: "milkDecorator",
      to: "simpleCoffee",
      type: "wraps",
      label: "wraps",
      description: "MilkDecorator was constructed around the SimpleCoffee instance.",
      code: "milkDecorator",
    },
    {
      id: "sugarExtends",
      from: "sugarDecorator",
      to: "coffeeDecorator",
      type: "implements",
      description:
        "SugarDecorator inherits the base in class-based tabs; Go embeds CoffeeDecorator and calls its forwarding methods explicitly.",
      bend: 30,
      code: "sugarDecorator",
    },
    {
      id: "milkExtends",
      from: "milkDecorator",
      to: "coffeeDecorator",
      type: "implements",
      description:
        "MilkDecorator inherits the base in class-based tabs; Go embeds CoffeeDecorator and calls its forwarding methods explicitly.",
      bend: -30,
      code: "milkDecorator",
    },
    {
      id: "wrappee",
      from: "coffeeDecorator",
      to: "coffee",
      type: "holds",
      label: "wrappee: Coffee",
      description:
        "CoffeeDecorator stores its wrapped object typed only as Coffee — the same interface it implements — so any decorator can wrap any Coffee, including another decorator.",
      bend: 40,
      code: "coffeeDecorator",
    },
    {
      id: "decoratorImpl",
      from: "coffeeDecorator",
      to: "coffee",
      type: "implements",
      description:
        "CoffeeDecorator implements Coffee, so any stack of decorators can stand in for a plain Coffee.",
      code: "coffeeDecorator",
    },
    {
      id: "simpleImpl",
      from: "simpleCoffee",
      to: "coffee",
      type: "implements",
      description: "SimpleCoffee implements Coffee directly.",
      code: "simpleCoffee",
    },
  ],
  steps: [
    {
      title: "Build the stack",
      description:
        "A SimpleCoffee is wrapped in a MilkDecorator, which is then wrapped in a SugarDecorator. Each layer only knows about the one directly inside it.",
      highlight: ["simpleCoffee", "wrapsCoffee", "milkDecorator", "wrapsMilk", "sugarDecorator"],
      notes: { simpleCoffee: "$2.00" },
      code: "usage",
    },
    {
      title: "Client calls cost()",
      description: "The client calls cost() once, on the outermost decorator — SugarDecorator.",
      highlight: ["client", "call", "sugarDecorator"],
      packets: [{ relation: "call", label: "cost()" }],
      code: "sugarDecorator",
    },
    {
      title: "Call travels inward",
      description:
        "SugarDecorator delegates to MilkDecorator before adding its own cost, which delegates to SimpleCoffee in turn.",
      highlight: ["sugarDecorator", "wrapsMilk", "milkDecorator", "wrapsCoffee", "simpleCoffee"],
      packets: [
        { relation: "wrapsMilk", label: "cost()" },
        { relation: "wrapsCoffee", label: "cost()", after: 0 },
      ],
      code: "milkDecorator",
    },
    {
      title: "Base price returns",
      description:
        "SimpleCoffee has no one left to delegate to — it just returns its own flat $2.00.",
      highlight: ["simpleCoffee", "wrapsCoffee", "milkDecorator"],
      packets: [{ relation: "wrapsCoffee", label: "$2.00", reverse: true }],
      notes: { simpleCoffee: "$2.00" },
      code: "simpleCoffee",
    },
    {
      title: "Price accumulates on the way out",
      description:
        "Each decorator adds its own cost to the value it gets back, so the price builds up as the result unwinds back to the client.",
      highlight: ["milkDecorator", "wrapsMilk", "sugarDecorator", "call", "client"],
      packets: [
        { relation: "wrapsMilk", label: "$2.50", reverse: true },
        { relation: "call", label: "$2.75", reverse: true, after: 0 },
      ],
      notes: { milkDecorator: "+$0.50", sugarDecorator: "+$0.25" },
      code: "sugarDecorator",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: DecoratorVisualization,
};
