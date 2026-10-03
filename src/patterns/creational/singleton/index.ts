import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from './example.go?raw'
import { SingletonVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "singleton",
  name: "Singleton",
  category: "creational",
  order: 1,
  summary:
    "Guarantee a class has exactly one instance, with one global point of access to it.",
  intent:
    'Make sure a class has exactly one instance, and give everyone a single, well-known way to reach it.',
  problem:
    "Some objects, like a configuration store, a connection pool or a logger, only make sense as one shared instance. If any code can call `new` freely, you can end up with several copies that disagree with each other, waste resources, or overwrite each other's state.",
  solution:
    "Restrict direct construction where the language permits, then expose one getInstance() method: the first call creates and stores the object, and later calls return that same object. TypeScript and C# enforce a private constructor, Python uses a runtime guard, and Go relies on an unexported constructor by convention because code in the same package can still construct the struct.",
  analogy:
    'A country has exactly one government at a time. You do not "construct" a new government whenever you need one. You go through the single office that already exists.',
  whenToUse: [
    "Exactly one instance of a class must exist, and many parts of the program need to reach it.",
    "You want stricter control over shared global state than a plain module-level variable gives you.",
    "You want to create an expensive shared resource lazily, the first time it is actually needed.",
  ],
  pros: [
    "You are guaranteed a single instance and one well-known way to get it.",
    "It can be created lazily, only when first requested.",
    "State that really is global lives in one place instead of being scattered around.",
  ],
  cons: [
    "It introduces global state, which hides dependencies and makes code harder to reason about.",
    "It is hard to unit test: classes that grab the singleton directly cannot easily be given a mock instance.",
    "With multiple threads, the lazy-creation check must be synchronized, or two threads can race and create two instances.",
  ],
  realWorld: [
    "A single application-wide configuration object or feature-flag store",
    "Database connection pools and caches shared across an app",
    "java.lang.Runtime.getRuntime() in Java",
    "A single Redux or Zustand store per application, which is a singleton by convention rather than by enforced construction",
  ],
  related: ["dependency-injection", "facade", "abstract-factory", "flyweight"],
  participants: [
    {
      id: "config",
      label: "AppConfig",
      role: "Singleton",
      kind: "class",
      x: 400,
      y: 90,
      width: 180,
      description:
        "A static field holds the shared instance. TypeScript and C# make construction private, Python uses a runtime guard, and Go provides an unexported constructor by convention (same-package code can still use an AppConfig literal). getInstance() creates the instance on first call and returns it thereafter.",
    },
    {
      id: "userService",
      label: "UserService",
      role: "Client",
      kind: "client",
      x: 150,
      y: 280,
      description:
        "Needs read access to configuration — asks AppConfig for the shared instance instead of constructing its own.",
    },
    {
      id: "paymentService",
      label: "PaymentService",
      role: "Client",
      kind: "client",
      x: 650,
      y: 280,
      description:
        "Also needs configuration — calling getInstance() here returns the exact same object UserService received.",
    },
  ],
  relations: [
    {
      id: "user-get",
      from: "userService",
      to: "config",
      type: "calls",
      label: "getInstance()",
      description:
        "UserService asks for the instance. Since none exists yet, AppConfig constructs it and caches it.",
      code: "getInstance",
    },
    {
      id: "payment-get",
      from: "paymentService",
      to: "config",
      type: "calls",
      label: "getInstance()",
      description:
        "PaymentService asks for the instance too. AppConfig finds the cached object and returns it unchanged.",
      bend: 40,
      code: "getInstance",
    },
  ],
  steps: [
    {
      title: "Restrict construction where possible",
      description:
        "TypeScript and C# reject direct construction through private constructors, and Python's runtime guard rejects AppConfig(). Go has no private constructor: newAppConfig() is the intended path, but code in package main can still construct AppConfig{} directly.",
      highlight: ["config"],
      notes: { config: "instance: null" },
      code: "class",
    },
    {
      title: "First request creates it",
      description:
        "UserService calls AppConfig.getInstance(). The static field is still null, so getInstance() constructs the one instance and stores it.",
      highlight: ["userService", "user-get"],
      packets: [
        { relation: "user-get", label: "getInstance()" },
        { relation: "user-get", label: "instance", reverse: true, after: 0 },
      ],
      notes: { config: "instance #1" },
      code: "getInstance",
    },
    {
      title: "Second request reuses it",
      description:
        "PaymentService calls getInstance() too. This time the field is already set, so the existing object is returned — no new construction.",
      highlight: ["paymentService", "payment-get"],
      packets: [
        { relation: "payment-get", label: "getInstance()" },
        { relation: "payment-get", label: "instance", reverse: true, after: 0 },
      ],
      notes: { config: "instance #1", paymentService: "same object" },
      code: "getInstance",
    },
    {
      title: "Same object, everywhere",
      description:
        "PaymentService calls updateApiUrl() on its config reference. Because UserService holds a reference to that exact same AppConfig object, it immediately sees the new value too.",
      highlight: ["userService", "paymentService", "config"],
      notes: { userService: "shares state", paymentService: "shares state" },
      code: "usage",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
  Visualization: SingletonVisualization,
};
