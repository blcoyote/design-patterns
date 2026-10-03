import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import { SingletonVisualization } from "./Visualization";

export const pattern: PatternDefinition = {
  slug: "singleton",
  name: "Singleton",
  category: "creational",
  order: 1,
  summary:
    "Guarantee a class has exactly one instance, with one global point of access to it.",
  intent:
    "Ensure a class has only one instance, and provide a global point of access to it.",
  problem:
    "Some objects — a configuration store, a connection pool, a logger — only make sense as a single shared instance. If any code can call `new` freely, you can end up with several copies that disagree with each other, waste resources, or step on each other’s state.",
  solution:
    "Make the constructor private so outside code cannot call `new` directly. Expose a static getInstance() method instead: the first call creates the one object and stores it; every later call returns that same stored object.",
  analogy:
    'A country has exactly one government at a time. You do not "construct" a new government whenever you need one — you go through the single, already-existing office.',
  whenToUse: [
    "Exactly one instance of a class must exist, and it must be reachable from many places.",
    "You want stricter control over global state than a plain module-level variable gives you.",
    "Lazily creating an expensive shared resource the first time it is actually needed.",
  ],
  pros: [
    "Guarantees a single instance and a well-known access point to it.",
    "Can be created lazily, only when first requested.",
    "Centralizes state that genuinely is global, instead of scattering it.",
  ],
  cons: [
    "Introduces global state, which hides dependencies and makes code harder to reason about.",
    "Hard to unit test: classes that reach for the singleton directly cannot easily be given a mock instance.",
    "In multi-threaded environments the lazy-init check must be synchronized, or two threads can race and create two instances.",
  ],
  realWorld: [
    "A single application-wide configuration object (process.env wrappers, feature-flag stores).",
    "Database connection pools and caches shared across an app.",
    "java.lang.Runtime.getRuntime() in Java",
    "A single Redux/Zustand store per application — singleton-like by convention, not by enforced construction",
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
        "Its constructor is off-limits to outside code (private in TS and C#, a runtime guard in Python) and a static field holds the one instance. getInstance() creates it on first call and returns the cached object thereafter.",
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
      title: "Private constructor",
      description:
        "AppConfig’s constructor is marked private. No outside code can write `new AppConfig()` directly — enforced at compile time in typed languages, or by a runtime guard in Python.",
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
  Visualization: SingletonVisualization,
};
