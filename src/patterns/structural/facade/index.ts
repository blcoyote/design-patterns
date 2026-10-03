import type { PatternDefinition } from "@/types/pattern";
import tsExample from "./example.ts?raw";
import csExample from "./example.cs?raw";
import pyExample from "./example.py?raw";
import goExample from "./example.go?raw";

export const pattern: PatternDefinition = {
  slug: "facade",
  name: "Facade",
  category: "structural",
  order: 3,
  summary: "Offer one simple entry point in front of a complicated subsystem.",
  intent:
    "Offer one simple interface in front of a complicated subsystem, so clients don't have to coordinate its many parts.",
  problem:
    "Watching a movie means lowering the screen, powering on the projector and switching it to widescreen, turning on the amplifier and setting its volume, and starting the DVD player, in the right order. Every place that wants to play a movie would need to know all four subsystems well and get the sequence right.",
  solution:
    "Add a HomeTheaterFacade with one method, watchMovie(). It holds references to all four subsystem objects and calls them in the correct order. Client code now depends on one simple method instead of four classes and the rules for using them together.",
  analogy:
    'Think of a restaurant front counter. You order "the lunch special" and the cashier coordinates the grill, the fryer and the drinks station behind the scenes. You never have to talk to the kitchen directly.',
  whenToUse: [
    "You want a simple entry point into a complex subsystem with many moving parts.",
    "You want client code to stay independent of the subsystem internals, so the subsystem can change freely.",
    "You are layering a system and want a clear API at the boundary of each layer.",
  ],
  pros: [
    "Client code is shielded from the subsystem’s complexity and from changes inside it.",
    "Clients and the subsystem are loosely coupled.",
    "Advanced clients can still use the subsystem classes directly if they need to.",
  ],
  cons: [
    'The facade can grow into a "god object" coupled to every class in the subsystem.',
    "It is one more layer that you must keep in sync with the subsystem it wraps.",
  ],
  realWorld: [
    "jQuery, which wraps raw DOM APIs behind a simpler interface",
    "A checkout() service that coordinates inventory, payment and shipping subsystems",
    "An SDK’s top-level client class that hides networking, auth and retry logic",
    "The C standard library (e.g. fopen/fread), which wraps lower-level OS calls",
  ],
  related: ["adapter", "mediator", "repository", "proxy"],
  participants: [
    {
      id: "client",
      label: "Client",
      role: "Client",
      kind: "client",
      x: 140,
      y: 90,
      description:
        "Just wants to watch a movie, and should not need to know an amplifier or projector exist.",
    },
    {
      id: "facade",
      label: "HomeTheaterFacade",
      role: "Facade",
      kind: "class",
      x: 440,
      y: 90,
      width: 190,
      description:
        "Exposes one method, watchMovie(), and internally owns and sequences the four subsystem objects.",
    },
    {
      id: "amplifier",
      label: "Amplifier",
      role: "Subsystem",
      kind: "class",
      x: 130,
      y: 280,
      description:
        "Powers on and sets its own volume level. Knows nothing about the facade or the other subsystems.",
    },
    {
      id: "dvdPlayer",
      label: "DvdPlayer",
      role: "Subsystem",
      kind: "class",
      x: 320,
      y: 280,
      description: "Starts playing the requested movie once everything else is ready.",
    },
    {
      id: "projector",
      label: "Projector",
      role: "Subsystem",
      kind: "class",
      x: 510,
      y: 280,
      description: "Powers on and switches to widescreen mode.",
    },
    {
      id: "screen",
      label: "Screen",
      role: "Subsystem",
      kind: "class",
      x: 690,
      y: 280,
      description: "Lowers itself so the projection is visible.",
    },
  ],
  relations: [
    {
      id: "client-call",
      from: "client",
      to: "facade",
      type: "calls",
      label: "watchMovie()",
      description:
        "The client makes exactly one call, regardless of how many subsystems are involved behind it.",
      code: "usage",
    },
    {
      id: "facade-screen",
      from: "facade",
      to: "screen",
      type: "calls",
      label: "down()",
      description: "First, the facade lowers the screen.",
      code: "watchMovie",
    },
    {
      id: "facade-projector",
      from: "facade",
      to: "projector",
      type: "calls",
      label: "on()",
      description: "Next, the facade powers on the projector and sets widescreen mode.",
      code: "watchMovie",
    },
    {
      id: "facade-amp",
      from: "facade",
      to: "amplifier",
      type: "calls",
      label: "on()",
      description: "Then the facade powers on the amplifier and sets the volume.",
      code: "watchMovie",
    },
    {
      id: "facade-dvd",
      from: "facade",
      to: "dvdPlayer",
      type: "calls",
      label: "play()",
      description: "Finally, the facade starts the DVD player playing the requested movie.",
      code: "watchMovie",
    },
  ],
  steps: [
    {
      title: "One simple call",
      description:
        'The client calls watchMovie("Inception") on the facade. That is the entire client-facing API.',
      highlight: ["client", "client-call", "facade"],
      packets: [{ relation: "client-call", label: "Inception" }],
      code: "usage",
    },
    {
      title: "Screen comes down",
      description: "The facade starts the sequence by lowering the screen.",
      highlight: ["facade", "facade-screen", "screen"],
      packets: [{ relation: "facade-screen" }],
      notes: { screen: "down" },
      code: "watchMovie",
    },
    {
      title: "Projector powers on",
      description: "Next the projector is switched on and set to widescreen.",
      highlight: ["facade", "facade-projector", "projector"],
      packets: [{ relation: "facade-projector" }],
      notes: { projector: "widescreen" },
      code: "watchMovie",
    },
    {
      title: "Amplifier powers on",
      description: "The amplifier is switched on and its volume is set to a sensible level.",
      highlight: ["facade", "facade-amp", "amplifier"],
      packets: [{ relation: "facade-amp" }],
      notes: { amplifier: "vol 5" },
      code: "watchMovie",
    },
    {
      title: "DVD starts playing",
      description:
        "Only once everything else is ready does the facade tell the DVD player to start.",
      highlight: ["facade", "facade-dvd", "dvdPlayer"],
      packets: [{ relation: "facade-dvd", label: "Inception" }],
      notes: { dvdPlayer: "▶ playing" },
      code: "watchMovie",
    },
    {
      title: "Client enjoys one interface",
      description: "From the client's point of view, four subsystems just became one method call.",
      highlight: ["client", "facade"],
      notes: { facade: "movie ready" },
      code: "facade",
    },
  ],
  code: tsExample,
  csharp: csExample,
  python: pyExample,
  go: goExample,
};
